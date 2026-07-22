import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/core/db/schema"
import { enqueueSyncAction, getPendingSyncActions } from "@/core/sync/queue"
import { SyncEngine, type SyncStatus } from "@/core/sync/engine"
import type { FileEntry, StorageProvider } from "@/core/storage/types"

class MemoryProvider implements StorageProvider {
  readonly id = "github"
  readonly name = "GitHub"
  readonly capabilities = {
    versionHistory: true,
    binaryFiles: false,
    folders: true,
    batchWrite: true,
  }
  files = new Map<string, FileEntry>()
  failWrites = false

  isConnected() {
    return true
  }
  async connect() {}
  async disconnect() {}
  async listFiles() {
    return [...this.files.values()]
  }
  async readFile(path: string) {
    return this.files.get(path) ?? null
  }
  async writeFile(path: string, content: string) {
    if (this.failWrites) throw new Error("offline")
    const entry = { path, content, etag: `etag-${content}`, lastModified: new Date() }
    this.files.set(path, entry)
    return entry
  }
  async deleteFile(path: string) {
    this.files.delete(path)
  }
}

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe("SyncEngine", () => {
  it("keeps failed writes pending and reports failed status", async () => {
    const provider = new MemoryProvider()
    provider.failWrites = true
    const statuses: SyncStatus[] = []
    await enqueueSyncAction("a.md", "write", "A")

    const engine = new SyncEngine({
      provider,
      cadenceMs: 60_000,
      idleMs: 1_000,
      onStatusChange: (status) => statuses.push(status),
      onConflict: vi.fn(),
    })

    await engine.flush()

    const pending = await getPendingSyncActions()
    expect(pending).toHaveLength(1)
    expect(pending[0].status).toBe("pending")
    expect(pending[0].attempts).toBe(1)
    expect(pending[0].error).toBe("offline")
    expect(statuses).toContain("failed")
    expect(statuses).not.toContain("remote-synced")
  })

  it("dispatches conflicts before overwriting remote content", async () => {
    const provider = new MemoryProvider()
    provider.files.set("a.md", {
      path: "a.md",
      content: "remote",
      etag: "remote-sha",
      lastModified: new Date(),
    })
    await db.files.put({
      path: "a.md",
      content: "local",
      lastModified: new Date(),
      synced: true,
      syncPending: false,
    })
    await enqueueSyncAction("a.md", "write", "mine")
    const onConflict = vi.fn()

    const engine = new SyncEngine({
      provider,
      cadenceMs: 60_000,
      idleMs: 1_000,
      onStatusChange: vi.fn(),
      onConflict,
    })

    await engine.flush()

    expect(onConflict).toHaveBeenCalledWith("a.md", "local", "remote")
    expect(provider.files.get("a.md")?.content).toBe("remote")
    const pending = await getPendingSyncActions()
    expect(pending).toHaveLength(1)
    expect(pending[0].status).toBe("pending")
    expect(pending[0].error).toContain("Conflict")
  })

  it("marks files remote-synced after a successful flush", async () => {
    const provider = new MemoryProvider()
    const statuses: SyncStatus[] = []
    await db.files.put({
      path: "a.md",
      content: "local",
      lastModified: new Date(),
      synced: false,
      syncPending: true,
    })
    await enqueueSyncAction("a.md", "write", "local")

    const engine = new SyncEngine({
      provider,
      cadenceMs: 60_000,
      idleMs: 1_000,
      onStatusChange: (status) => statuses.push(status),
      onConflict: vi.fn(),
    })

    await engine.flush()

    expect(await getPendingSyncActions()).toEqual([])
    expect(await db.files.get("a.md")).toMatchObject({ synced: true, syncPending: false })
    expect(statuses).toContain("remote-synced")
  })
})
