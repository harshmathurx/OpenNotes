import { describe, expect, it, beforeEach } from "vitest"
import {
  FileSystemProvider,
  SKIPPED_DIRECTORIES,
  MAX_SCAN_DEPTH,
  isMarkdownFile,
  isTraversableDirectory,
  joinPath,
  splitPath,
} from "@/core/storage/filesystem"

/**
 * Pure-logic tests for FileSystemProvider using a mocked
 * FileSystemDirectoryHandle. No real File System Access API exists in
 * jsdom; the fake below implements just enough of the interface
 * (async iteration, getFileHandle, getDirectoryHandle, createWritable,
 * removeEntry, queryPermission).
 */

type FakeFile = {
  kind: "file"
  name: string
  content: string
  lastModified: number
}

type FakeDir = {
  kind: "directory"
  name: string
  children: Map<string, FakeNode>
}

type FakeNode = FakeFile | FakeDir

function file(name: string, content = "", lastModified = 1_700_000_000_000): FakeFile {
  return { kind: "file", name, content, lastModified }
}

function dir(name: string, children: FakeNode[] = []): FakeDir {
  return {
    kind: "directory",
    name,
    children: new Map(children.map((c) => [c.name, c])),
  }
}

function toFileHandle(fake: FakeFile): FileSystemFileHandle {
  return {
    kind: "file",
    name: fake.name,
    async getFile() {
      return new File([fake.content], fake.name, {
        lastModified: fake.lastModified,
      })
    },
    async createWritable() {
      return {
        async write(data: unknown) {
          fake.content = typeof data === "string" ? data : String(data)
          fake.lastModified = Date.now()
        },
        async close() {},
      } as unknown as FileSystemWritableFileStream
    },
  } as unknown as FileSystemFileHandle
}

function toDirHandle(
  fake: FakeDir,
  permission: PermissionState = "granted"
): FileSystemDirectoryHandle {
  const handle = {
    kind: "directory",
    name: fake.name,
    async *entries() {
      for (const child of fake.children.values()) {
        yield child.kind === "file"
          ? toFileHandle(child)
          : toDirHandle(child, permission)
      }
      // The provider iterates the handle itself as AsyncIterable<FileSystemHandle>.
    },
    [Symbol.asyncIterator]: async function* () {
      for (const child of fake.children.values()) {
        yield child.kind === "file"
          ? toFileHandle(child)
          : toDirHandle(child, permission)
      }
    },
    async getDirectoryHandle(
      name: string,
      options?: FileSystemGetDirectoryOptions
    ) {
      const child = fake.children.get(name)
      if (child?.kind === "directory") return toDirHandle(child, permission)
      if (options?.create) {
        const created = dir(name)
        fake.children.set(name, created)
        return toDirHandle(created, permission)
      }
      throw new DOMException(`No such directory: ${name}`, "NotFoundError")
    },
    async getFileHandle(name: string, options?: FileSystemGetFileOptions) {
      const child = fake.children.get(name)
      if (child?.kind === "file") return toFileHandle(child)
      if (options?.create) {
        const created = file(name)
        fake.children.set(name, created)
        return toFileHandle(created)
      }
      throw new DOMException(`No such file: ${name}`, "NotFoundError")
    },
    async removeEntry(name: string) {
      if (!fake.children.delete(name)) {
        throw new DOMException(`No such entry: ${name}`, "NotFoundError")
      }
    },
    async queryPermission() {
      return permission
    },
    async requestPermission() {
      return permission
    },
  }
  return handle as unknown as FileSystemDirectoryHandle
}

describe("pure helpers", () => {
  it("matches markdown extensions case-insensitively", () => {
    expect(isMarkdownFile("note.md")).toBe(true)
    expect(isMarkdownFile("note.MD")).toBe(true)
    expect(isMarkdownFile("note.markdown")).toBe(true)
    expect(isMarkdownFile("note.txt")).toBe(false)
    expect(isMarkdownFile("md")).toBe(false)
    expect(isMarkdownFile(".md")).toBe(true)
  })

  it("joins paths with a single slash", () => {
    expect(joinPath("", "a.md")).toBe("a.md")
    expect(joinPath("notes", "a.md")).toBe("notes/a.md")
    expect(joinPath("notes/deep", "a.md")).toBe("notes/deep/a.md")
  })

  it("splits paths into non-empty segments", () => {
    expect(splitPath("a/b/c.md")).toEqual(["a", "b", "c.md"])
    expect(splitPath("a//b.md")).toEqual(["a", "b.md"])
    expect(splitPath("/a.md")).toEqual(["a.md"])
    expect(splitPath("")).toEqual([])
  })

  it("recognizes traversable directories", () => {
    expect(isTraversableDirectory("notes")).toBe(true)
    expect(isTraversableDirectory(".git")).toBe(false)
    expect(isTraversableDirectory(".obsidian")).toBe(false)
    expect(isTraversableDirectory(".hidden")).toBe(false)
    expect(isTraversableDirectory("node_modules")).toBe(false)
    expect(SKIPPED_DIRECTORIES.has(".trash")).toBe(true)
  })
})

describe("FileSystemProvider recursion", () => {
  let root: FakeDir
  let provider: FileSystemProvider

  beforeEach(() => {
    root = dir("vault", [
      file("top.md", "top"),
      file("ignore.txt", "nope"),
      file("image.png", "nope"),
      dir("notes", [
        file("a.md", "a"),
        dir("deep", [file("b.markdown", "b")]),
      ]),
      dir(".git", [file("secret.md", "should be skipped")]),
      dir(".obsidian", [file("config.md", "should be skipped")]),
      dir("node_modules", [file("dep.md", "should be skipped")]),
      dir(".hidden", [file("h.md", "should be skipped")]),
      dir("empty", []),
    ])
    provider = new FileSystemProvider(toDirHandle(root))
  })

  it("lists only markdown files, recursively, with relative paths", async () => {
    const files = await provider.listFiles()
    const paths = files.map((f) => f.path).sort()
    expect(paths).toEqual(["notes/a.md", "notes/deep/b.markdown", "top.md"])
  })

  it("returns content and lastModified for each entry", async () => {
    const files = await provider.listFiles()
    const top = files.find((f) => f.path === "top.md")
    expect(top?.content).toBe("top")
    expect(top?.lastModified).toBeInstanceOf(Date)
  })

  it("returns [] when permission is not granted", async () => {
    const denied = new FileSystemProvider(toDirHandle(root, "prompt"))
    await expect(denied.listFiles()).resolves.toEqual([])
  })

  it("returns [] when no handle is set", async () => {
    const empty = new FileSystemProvider()
    await expect(empty.listFiles()).resolves.toEqual([])
  })

  it("respects the max depth guard", async () => {
    // Build a chain deeper than MAX_SCAN_DEPTH: d0/d1/.../dN/deep.md
    const leaf = dir(`d${MAX_SCAN_DEPTH + 1}`, [file("too-deep.md", "x")])
    let current = leaf
    for (let i = MAX_SCAN_DEPTH; i >= 1; i--) {
      current = dir(`d${i}`, [current])
    }
    const deepRoot = dir("vault", [current, file("shallow.md", "ok")])
    const deepProvider = new FileSystemProvider(toDirHandle(deepRoot))

    const files = await deepProvider.listFiles()
    const paths = files.map((f) => f.path)
    expect(paths).toContain("shallow.md")
    expect(paths.some((p) => p.endsWith("too-deep.md"))).toBe(false)
  })

  it("skips unreadable entries without failing the whole scan", async () => {
    const weird = dir("vault", [file("good.md", "ok")])
    const handle = toDirHandle(weird)
    // Sabotage one iteration result.
    const original = handle.getDirectoryHandle.bind(handle)
    handle.getDirectoryHandle = async (name: string, opts?: FileSystemGetDirectoryOptions) => {
      if (name === "boom") throw new DOMException("nope", "NotAllowedError")
      return original(name, opts)
    }
    const files = await new FileSystemProvider(handle).listFiles()
    expect(files.map((f) => f.path)).toEqual(["good.md"])
  })
})

describe("FileSystemProvider read/write/delete", () => {
  let root: FakeDir
  let provider: FileSystemProvider

  beforeEach(() => {
    root = dir("vault", [dir("notes", [file("a.md", "a")])])
    provider = new FileSystemProvider(toDirHandle(root))
  })

  it("writes a file creating parent directories and returns fresh lastModified", async () => {
    const entry = await provider.writeFile("brand/new/note.md", "hello")
    expect(entry.path).toBe("brand/new/note.md")
    expect(entry.content).toBe("hello")
    expect(entry.lastModified).toBeInstanceOf(Date)

    const read = await provider.readFile("brand/new/note.md")
    expect(read?.content).toBe("hello")
  })

  it("overwrites existing content", async () => {
    await provider.writeFile("notes/a.md", "v2")
    const read = await provider.readFile("notes/a.md")
    expect(read?.content).toBe("v2")
  })

  it("deletes an existing file", async () => {
    await provider.deleteFile("notes/a.md")
    await expect(provider.readFile("notes/a.md")).resolves.toBeNull()
  })

  it("tolerates deleting a missing file and missing parents", async () => {
    await expect(provider.deleteFile("notes/missing.md")).resolves.toBeUndefined()
    await expect(provider.deleteFile("no/such/dir.md")).resolves.toBeUndefined()
  })

  it("throws on write when disconnected", async () => {
    const empty = new FileSystemProvider()
    await expect(empty.writeFile("x.md", "y")).rejects.toThrow("No folder opened.")
  })

  it("reads a single file and returns null for missing files", async () => {
    const read = await provider.readFile("notes/a.md")
    expect(read).toMatchObject({ path: "notes/a.md", content: "a" })
    await expect(provider.readFile("notes/missing.md")).resolves.toBeNull()
  })
})
