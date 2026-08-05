import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/core/db/schema"
import {
  deleteVaultFile,
  flushAllVaultSaves,
  renameVaultFile,
  saveVaultFile,
  vaultSaveQueue,
} from "@/core/vault/mutations"
import type { VaultBackend } from "@/core/vault/mutations"
import type { FileEntry } from "@/core/storage/types"

/**
 * End-to-end write-path coalescing: N rapid saveVaultFile calls (what typing
 * produces via useVault.saveFile) must collapse into ≤1 disk write + ≤1 DB
 * write per debounce window — never O(N) — while flush keeps durability.
 *
 * NOTE: fake-indexeddb schedules transactions via a jsdom-realm setImmediate
 * that vitest's fake timers intercept and freeze, so these integration tests
 * use real timers and drive the coalesced write via flush (the debounced
 * timer behavior itself is fake-timer-proven in tests/vault/saveQueue.test.ts).
 */

function entry(path: string, content: string): FileEntry {
  return { path, content, lastModified: new Date() }
}

/** Backend spy standing in for FolderVaultStore (the Mac disk writer). */
function mockBackend() {
  return {
    writeFile: vi.fn(async (path: string, content: string): Promise<FileEntry> =>
      entry(path, content)
    ),
    readFile: vi.fn(async (path: string): Promise<FileEntry | null> => {
      const row = await db.files.get(path)
      return row ? entry(row.path, row.content) : null
    }),
    deleteFile: vi.fn(async (): Promise<void> => {}),
  } satisfies VaultBackend
}

/** Count live db.files.put calls for one assertion window. */
function spyOnDbPuts() {
  const calls: Array<{ path: string; content: string }> = []
  const original = db.files.put.bind(db.files)
  const spy = vi.spyOn(db.files, "put").mockImplementation((row, key?) => {
    calls.push({ path: row.path, content: row.content })
    return original(row, key)
  })
  return { calls, restore: () => spy.mockRestore() }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(async () => {
  // Never leak a pending queue timer across tests: while fake timers are
  // installed the trailing edge can't run on its own, so flushAll drains
  // pending writes synchronously (no timer advancement needed — and no
  // fire-and-forget promises left to race the next db.delete()).
  await flushAllVaultSaves().catch(() => {})
  vi.useRealTimers()
})

describe("write path coalescing (disk backend)", () => {
  it("20 rapid keystroke-saves → ≤1 disk write per window, with the LATEST content", async () => {
    const backend = mockBackend()
    const dbSpy = spyOnDbPuts()
    try {
      // Leading-edge save (note open / first keystroke after idle).
      await saveVaultFile("note.md", "k0", backend)
      expect(backend.writeFile).toHaveBeenCalledTimes(1)

      // 20 rapid keystrokes inside the debounce window.
      for (let i = 1; i <= 20; i++) {
        void saveVaultFile("note.md", `k${i}`, backend)
      }
      // No additional writes yet — everything is coalescing.
      expect(backend.writeFile).toHaveBeenCalledTimes(1)

      // Simulate the trailing-edge timer by flushing exactly what the
      // debounce would: one write carrying the last keystroke.
      await vaultSaveQueue.flush("note.md")

      expect(backend.writeFile).toHaveBeenCalledTimes(2)
      expect(backend.writeFile).toHaveBeenLastCalledWith("note.md", "k20")
      // The DB mirror put fired exactly once per persistence — not per keystroke.
      const forNote = dbSpy.calls.filter((c) => c.path === "note.md")
      expect(forNote.length).toBe(2) // leading + trailing, for 21 saves
      expect(forNote[1].content).toBe("k20")
    } finally {
      dbSpy.restore()
    }
  })

  it("flush lands a pending write immediately — disk holds the latest before the window ends", async () => {
    const backend = mockBackend()
    await saveVaultFile("note.md", "typed", backend)
    void saveVaultFile("note.md", "typed more", backend)

    // Cmd+S / note-switch / unmount: durability can't wait for the timer.
    await flushAllVaultSaves()

    expect(backend.writeFile).toHaveBeenLastCalledWith("note.md", "typed more")
    expect(vaultSaveQueue.isPending("note.md")).toBe(false)
    const row = await db.files.get("note.md")
    expect(row?.content).toBe("typed more")
  })

  it("delete flushes the pending save before removing (no lost writes, correct ordering)", async () => {
    const backend = mockBackend()
    await saveVaultFile("note.md", "final words", backend)
    void saveVaultFile("note.md", "final words!", backend)

    await deleteVaultFile("note.md", backend)

    // The last content landed on disk BEFORE the delete ran.
    expect(backend.writeFile).toHaveBeenLastCalledWith("note.md", "final words!")
    expect(backend.deleteFile).toHaveBeenCalledWith("note.md")
    const writeIdx = backend.writeFile.mock.invocationCallOrder[0]
    const deleteIdx = backend.deleteFile.mock.invocationCallOrder[0]
    expect(writeIdx).toBeLessThan(deleteIdx)
    expect(await db.files.get("note.md")).toBeUndefined()
  })

  it("rename flushes the pending save first so the new file carries the latest content", async () => {
    const backend = mockBackend()
    await saveVaultFile("old.md", "draft", backend)
    void saveVaultFile("old.md", "draft v2", backend)

    const target = await renameVaultFile("old.md", "renamed", backend)

    expect(target).toBe("renamed.md")
    // The rename read-old→write-new happened after the flush, so the new
    // file got "draft v2", not a stale snapshot.
    expect(backend.writeFile).toHaveBeenLastCalledWith("renamed.md", "draft v2")
    expect(await db.files.get("renamed.md")).toMatchObject({
      content: "draft v2",
    })
    expect(await db.files.get("old.md")).toBeUndefined()
  })
})

describe("write path coalescing (IndexedDB-only)", () => {
  it("20 rapid saves → 2 db.files.put calls total, latest content wins", async () => {
    const dbSpy = spyOnDbPuts()
    try {
      await saveVaultFile("note.md", "v0")
      for (let i = 1; i <= 20; i++) {
        void saveVaultFile("note.md", `v${i}`)
      }
      expect(dbSpy.calls.filter((c) => c.path === "note.md")).toHaveLength(1)

      await vaultSaveQueue.flush("note.md")

      const forNote = dbSpy.calls.filter((c) => c.path === "note.md")
      expect(forNote).toHaveLength(2)
      expect(forNote[1].content).toBe("v20")
      expect(await db.files.get("note.md")).toMatchObject({ content: "v20" })
    } finally {
      dbSpy.restore()
    }
  })

  it("saves to different notes never coalesce into each other", async () => {
    await saveVaultFile("a.md", "A")
    await saveVaultFile("b.md", "B")
    void saveVaultFile("a.md", "A2")

    await flushAllVaultSaves()

    expect(await db.files.get("a.md")).toMatchObject({ content: "A2" })
    expect(await db.files.get("b.md")).toMatchObject({ content: "B" })
  })

  it("without any flush, the debounced trailing edge still lands the latest within ~400ms", async () => {
    // Real-timer proof that no manual flush is required for durability:
    // typing then pausing persists the latest content on the trailing edge.
    const backend = mockBackend()
    await saveVaultFile("note.md", "start", backend)
    for (let i = 1; i <= 10; i++) {
      void saveVaultFile("note.md", `start +${i}`, backend)
    }
    expect(backend.writeFile).toHaveBeenCalledTimes(1)

    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(backend.writeFile).toHaveBeenCalledTimes(2)
    expect(backend.writeFile).toHaveBeenLastCalledWith("note.md", "start +10")
  })
})
