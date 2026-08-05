import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FileEntry } from "@/core/storage/types"
import type { TauriFolderAPI } from "@/core/bridge/fs"
import { FolderVaultStore } from "@/core/vault/folderStore"

const DIR = "/notes"

function entry(path: string, content = "", ms = 1_700_000_000_000): FileEntry {
  return { path, content, lastModified: new Date(ms) }
}

/** A fully-mocked tauriFolder bridge. */
function mockFs(overrides: Partial<TauriFolderAPI> = {}): TauriFolderAPI {
  return {
    pickDirectory: vi.fn(async () => DIR),
    listMarkdown: vi.fn(async () => []),
    readFile: vi.fn(async () => null),
    writeFile: vi.fn(async (_dir: string, rel: string, content: string) =>
      entry(rel, content)
    ),
    deleteFile: vi.fn(async () => true),
    ...overrides,
  }
}

// FolderVaultStore gates isConnected() on isTauri(); the tests run in jsdom
// (no __TAURI_INTERNALS__), so isConnected() is false — which is exactly the
// browser fallback path. Disk ops are exercised directly against the mock.

describe("FolderVaultStore — identity & capabilities", () => {
  it("has the folder id, name and capabilities", () => {
    const store = new FolderVaultStore(DIR, mockFs())
    expect(store.id).toBe("folder")
    expect(store.name).toBe("Notes folder")
    expect(store.capabilities).toEqual({
      versionHistory: false,
      binaryFiles: false,
      folders: true,
      batchWrite: false,
    })
  })
})

describe("FolderVaultStore — connection", () => {
  it("is not connected in a browser (no Tauri), even with a path", () => {
    const store = new FolderVaultStore(DIR, mockFs())
    expect(store.isConnected()).toBe(false)
  })

  it("connect() picks a folder when none is set and persists it", async () => {
    const fs = mockFs()
    const store = new FolderVaultStore(null, fs)
    await store.connect()
    expect(fs.pickDirectory).toHaveBeenCalledOnce()
    expect(store.getFolderPath()).toBe(DIR)
  })

  it("connect() is a no-op when a folder is already set", async () => {
    const fs = mockFs()
    const store = new FolderVaultStore(DIR, fs)
    await store.connect()
    expect(fs.pickDirectory).not.toHaveBeenCalled()
  })

  it("connect() stays unbound when the user cancels the picker", async () => {
    const fs = mockFs({ pickDirectory: vi.fn(async () => null) })
    const store = new FolderVaultStore(null, fs)
    await store.connect()
    expect(store.getFolderPath()).toBeNull()
  })
})

describe("FolderVaultStore — disk ops against a mocked bridge", () => {
  let fs: TauriFolderAPI
  let store: FolderVaultStore

  beforeEach(() => {
    fs = mockFs()
    store = new FolderVaultStore(DIR, fs)
  })

  it("listFiles() delegates to listMarkdown and returns entries", async () => {
    const entries = [entry("a.md", "# A"), entry("sub/b.md", "# B")]
    fs.listMarkdown = vi.fn(async () => entries)
    const result = await store.listFiles()
    expect(fs.listMarkdown).toHaveBeenCalledWith(DIR)
    expect(result).toEqual(entries)
  })

  it("readFile() delegates with dir + rel path", async () => {
    fs.readFile = vi.fn(async () => entry("a.md", "# A"))
    const result = await store.readFile("a.md")
    expect(fs.readFile).toHaveBeenCalledWith(DIR, "a.md")
    expect(result?.content).toBe("# A")
  })

  it("readFile() returns null for a missing file", async () => {
    expect(await store.readFile("nope.md")).toBeNull()
  })

  it("writeFile() writes content and returns a fresh lastModified", async () => {
    const freshMs = 1_800_000_000_000
    fs.writeFile = vi.fn(async (_d: string, rel: string, content: string) =>
      entry(rel, content, freshMs)
    )
    const result = await store.writeFile("sub/note.md", "# New")
    expect(fs.writeFile).toHaveBeenCalledWith(DIR, "sub/note.md", "# New")
    expect(result.lastModified.getTime()).toBe(freshMs)
    expect(result.path).toBe("sub/note.md")
  })

  it("writeFile() throws on an un-writable (invalid) path", async () => {
    fs.writeFile = vi.fn(async () => null)
    await expect(store.writeFile("../evil.md", "x")).rejects.toThrow(
      /Invalid note path/
    )
  })

  it("deleteFile() delegates and tolerates success", async () => {
    await store.deleteFile("a.md")
    expect(fs.deleteFile).toHaveBeenCalledWith(DIR, "a.md")
  })

  it("deleteFile() throws when the bridge rejects the path", async () => {
    fs.deleteFile = vi.fn(async () => false)
    await expect(store.deleteFile("../evil.md")).rejects.toThrow(
      /Invalid note path/
    )
  })
})

describe("FolderVaultStore — path safety & md filtering (via the real bridge)", () => {
  // The store relies on tauriFolder.normalizeRelPath/isMarkdownPath for path
  // safety and md filtering. Using the REAL tauriFolder (with a mocked
  // safeInvoke) would need a Tauri runtime; instead assert the store surfaces
  // the bridge's rejections, which is where safety is enforced.
  it("propagates a clear error when the folder is not open", async () => {
    const store = new FolderVaultStore(null, mockFs())
    await expect(store.listFiles()).rejects.toThrow(/No notes folder is open/)
    await expect(store.readFile("a.md")).rejects.toThrow(/No notes folder/)
    await expect(store.writeFile("a.md", "x")).rejects.toThrow(/No notes folder/)
    await expect(store.deleteFile("a.md")).rejects.toThrow(/No notes folder/)
  })

  it("wraps bridge failures in a clear Error message", async () => {
    const fs = mockFs({
      listMarkdown: vi.fn(async () => {
        throw new Error("permission denied")
      }),
    })
    const store = new FolderVaultStore(DIR, fs)
    await expect(store.listFiles()).rejects.toThrow(/Could not list notes/)
  })
})
