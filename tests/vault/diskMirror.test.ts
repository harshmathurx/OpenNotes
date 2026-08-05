import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/core/db/schema"
import {
  reconcileFromDisk,
  removeOnDelete,
  upsertOnWrite,
} from "@/core/vault/diskMirror"
import type { FileEntry, StorageProvider } from "@/core/storage/types"

function entry(
  path: string,
  content: string,
  mtime = 1_000
): FileEntry {
  return { path, content, lastModified: new Date(mtime) }
}

/** Mocked FolderVaultStore — only the surface reconcile/upsert touch. */
function mockStore() {
  return {
    writeFile: vi.fn(async (path: string, content: string): Promise<FileEntry> =>
      entry(path, content, Date.now())
    ),
  } satisfies Pick<StorageProvider, "writeFile">
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe("diskMirror reconcileFromDisk", () => {
  it("adds files that exist on disk but not in the cache", async () => {
    const result = await reconcileFromDisk([
      entry("a.md", "A"),
      entry("b.md", "B"),
    ])

    expect(result).toEqual({
      added: ["a.md", "b.md"],
      updated: [],
      removed: [],
      conflicts: [],
    })
    expect(await db.files.get("a.md")).toMatchObject({
      content: "A",
      synced: true,
      syncPending: false,
    })
    expect(await db.files.count()).toBe(2)
  })

  it("updates the cache when the on-disk content changed", async () => {
    const diskMtime = 1_000
    await db.files.put({
      path: "a.md",
      content: "old",
      lastModified: new Date(diskMtime),
      synced: true,
      syncPending: false,
    })

    const result = await reconcileFromDisk([
      entry("a.md", "new", diskMtime + 500),
    ])

    expect(result).toMatchObject({ added: [], updated: ["a.md"], conflicts: [] })
    const row = await db.files.get("a.md")
    expect(row?.content).toBe("new")
    expect(row?.lastModified).toEqual(new Date(diskMtime + 500))
  })

  it("leaves rows with identical content untouched", async () => {
    await db.files.put({
      path: "a.md",
      content: "same",
      lastModified: new Date(1_000),
      synced: true,
      syncPending: false,
    })

    const result = await reconcileFromDisk([entry("a.md", "same", 9_999)])

    expect(result).toEqual({ added: [], updated: [], removed: [], conflicts: [] })
  })

  it("removes cache rows that vanished from disk", async () => {
    await db.files.put({
      path: "gone.md",
      content: "ghost",
      lastModified: new Date(1_000),
      synced: true,
      syncPending: false,
    })
    await db.files.put({
      path: "kept.md",
      content: "kept",
      lastModified: new Date(1_000),
      synced: true,
      syncPending: false,
    })

    const result = await reconcileFromDisk([entry("kept.md", "kept", 1_000)])

    expect(result.removed).toEqual(["gone.md"])
    expect(await db.files.get("gone.md")).toBeUndefined()
    expect(await db.files.get("kept.md")).toBeDefined()
  })

  it("keeps cache rows with a pending remote sync even when absent on disk", async () => {
    await db.files.put({
      path: "queued.md",
      content: "not yet synced",
      lastModified: new Date(1_000),
      synced: false,
      syncPending: true,
    })

    const result = await reconcileFromDisk([])

    expect(result.removed).toEqual([])
    expect(await db.files.get("queued.md")).toBeDefined()
  })

  it("preserves both sides on a true conflict: disk wins, cache copy kept as (conflict)", async () => {
    const diskMtime = 1_000
    // Cache drifted forward (edited in-app after the last disk sync) AND
    // the content differs from disk → true conflict.
    await db.files.put({
      path: "note.md",
      content: "local edit",
      lastModified: new Date(diskMtime + 500),
      synced: true,
      syncPending: false,
    })

    const store = mockStore()
    const result = await reconcileFromDisk(
      [entry("note.md", "external edit", diskMtime)],
      store
    )

    expect(result.conflicts).toEqual(["note (conflict).md"])
    expect(result.updated).toEqual(["note.md"])

    // Disk wins the canonical path.
    expect(await db.files.get("note.md")).toMatchObject({
      content: "external edit",
    })
    // Local edit survives as a conflict copy…
    expect(await db.files.get("note (conflict).md")).toMatchObject({
      content: "local edit",
    })
    // …and is written back to disk via the store.
    expect(store.writeFile).toHaveBeenCalledWith(
      "note (conflict).md",
      "local edit"
    )
  })

  it("still writes a conflict copy without a store (cache-only safety net)", async () => {
    await db.files.put({
      path: "note.md",
      content: "local edit",
      lastModified: new Date(2_000),
      synced: true,
      syncPending: false,
    })

    const result = await reconcileFromDisk([entry("note.md", "external edit", 1_000)])

    expect(result.conflicts).toEqual(["note (conflict).md"])
    expect(await db.files.get("note (conflict).md")).toMatchObject({
      content: "local edit",
    })
    expect(await db.files.get("note.md")).toMatchObject({
      content: "external edit",
    })
  })
})

describe("diskMirror write-path helpers", () => {
  it("upsertOnWrite mirrors the disk entry as synced", async () => {
    await upsertOnWrite(entry("x.md", "X", 5_000))

    expect(await db.files.get("x.md")).toMatchObject({
      content: "X",
      lastModified: new Date(5_000),
      synced: true,
      syncPending: false,
    })
  })

  it("removeOnDelete drops the cache row", async () => {
    await db.files.put({
      path: "x.md",
      content: "X",
      lastModified: new Date(),
      synced: true,
      syncPending: false,
    })

    await removeOnDelete("x.md")

    expect(await db.files.get("x.md")).toBeUndefined()
  })
})
