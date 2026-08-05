import { describe, expect, it } from "vitest"
import {
  buildTree,
  dtoToFileEntry,
  filterMarkdownPaths,
  isMarkdownPath,
  normalizeRelPath,
  type FileEntryDto,
} from "@/core/bridge/fs"
import type { FileEntry } from "@/core/storage/types"

describe("dtoToFileEntry", () => {
  it("converts modified_ms to a Date and drops no fields", () => {
    const dto: FileEntryDto = {
      path: "notes/todo.md",
      content: "# Todo",
      modified_ms: 1_700_000_000_000,
    }
    const entry = dtoToFileEntry(dto)
    expect(entry.path).toBe("notes/todo.md")
    expect(entry.content).toBe("# Todo")
    expect(entry.lastModified).toBeInstanceOf(Date)
    expect(entry.lastModified.getTime()).toBe(1_700_000_000_000)
    expect(entry.etag).toBeUndefined()
  })

  it("handles epoch 0 (missing mtime sentinel from Rust)", () => {
    const entry = dtoToFileEntry({ path: "a.md", content: "", modified_ms: 0 })
    expect(entry.lastModified.getTime()).toBe(0)
  })
})

describe("normalizeRelPath", () => {
  it("passes a clean posix path through unchanged", () => {
    expect(normalizeRelPath("notes/daily/2024-01-01.md")).toBe(
      "notes/daily/2024-01-01.md",
    )
  })

  it("converts backslashes to forward slashes", () => {
    expect(normalizeRelPath("notes\\todo.md")).toBe("notes/todo.md")
  })

  it("collapses duplicate separators and resolves '.' segments", () => {
    expect(normalizeRelPath("notes//daily/./x.md")).toBe("notes/daily/x.md")
  })

  it("rejects parent traversal", () => {
    expect(normalizeRelPath("../outside.md")).toBeNull()
    expect(normalizeRelPath("notes/../../outside.md")).toBeNull()
    expect(normalizeRelPath("..\\outside.md")).toBeNull()
  })

  it("rejects absolute paths", () => {
    expect(normalizeRelPath("/etc/passwd")).toBeNull()
  })

  it("rejects empty and contentless paths", () => {
    expect(normalizeRelPath("")).toBeNull()
    expect(normalizeRelPath("//./")).toBeNull()
  })
})

describe("isMarkdownPath", () => {
  it("matches .md case-insensitively", () => {
    expect(isMarkdownPath("a.md")).toBe(true)
    expect(isMarkdownPath("a.MD")).toBe(true)
    expect(isMarkdownPath("dir/b.Md")).toBe(true)
  })

  it("rejects non-markdown files", () => {
    expect(isMarkdownPath("a.txt")).toBe(false)
    expect(isMarkdownPath("a.mdx")).toBe(false)
    expect(isMarkdownPath("a.md.bak")).toBe(false)
  })
})

describe("filterMarkdownPaths", () => {
  it("keeps only normalizable markdown paths", () => {
    const input = [
      "a.md",
      "b.txt",
      "sub/c.MD",
      "../evil.md",
      "/abs.md",
      "",
      "sub\\d.md",
    ]
    expect(filterMarkdownPaths(input)).toEqual(["a.md", "sub/c.MD", "sub/d.md"])
  })
})

function entry(path: string): FileEntry {
  return { path, content: "", lastModified: new Date(0) }
}

describe("buildTree", () => {
  it("builds a nested tree from a flat list", () => {
    const tree = buildTree([
      entry("projects/opennotes/roadmap.md"),
      entry("projects/opennotes/todo.md"),
      entry("inbox.md"),
    ])

    expect(tree).toHaveLength(2)
    // Folders sort before files.
    expect(tree[0].name).toBe("projects")
    expect(tree[0].entry).toBeUndefined()
    expect(tree[1].name).toBe("inbox.md")
    expect(tree[1].entry?.path).toBe("inbox.md")

    const projects = tree[0].children!
    expect(projects).toHaveLength(1)
    expect(projects[0].name).toBe("opennotes")
    expect(projects[0].path).toBe("projects/opennotes")

    const files = projects[0].children!
    expect(files.map((f) => f.name)).toEqual(["roadmap.md", "todo.md"])
    expect(files[0].entry?.path).toBe("projects/opennotes/roadmap.md")
  })

  it("sorts folders before files and alphabetically within kind", () => {
    const tree = buildTree([
      entry("z.md"),
      entry("beta/x.md"),
      entry("a.md"),
      entry("alpha/x.md"),
    ])
    expect(tree.map((n) => n.name)).toEqual(["alpha", "beta", "a.md", "z.md"])
  })

  it("reuses folder nodes shared by multiple files", () => {
    const tree = buildTree([entry("d/a.md"), entry("d/b.md"), entry("d/sub/c.md")])
    // One shared "d" folder containing sub/, a.md, b.md (folders first).
    expect(tree).toHaveLength(1)
    expect(tree[0].name).toBe("d")
    expect(tree[0].children!.map((n) => n.name)).toEqual(["sub", "a.md", "b.md"])
    expect(tree[0].children![0].children![0].path).toBe("d/sub/c.md")
  })

  it("handles an empty list", () => {
    expect(buildTree([])).toEqual([])
  })
})
