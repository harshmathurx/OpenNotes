import { safeInvoke } from "./runtime"
import { pickDirectory } from "./dialog"
import type { FileEntry } from "@/core/storage/types"

export { pickDirectory }

/**
 * Wire shape returned by the Rust fs commands. `modified_ms` is
 * milliseconds since the Unix epoch; the bridge converts it to a `Date`.
 */
export interface FileEntryDto {
  path: string
  content: string
  modified_ms: number
}

/**
 * Convert a Rust DTO into the storage-layer `FileEntry` shape
 * (core/storage/types.ts). `etag` stays undefined — the filesystem has
 * no native versioning token.
 */
export function dtoToFileEntry(dto: FileEntryDto): FileEntry {
  return {
    path: dto.path,
    content: dto.content,
    lastModified: new Date(dto.modified_ms),
  }
}

/**
 * Normalize a user-supplied relative note path before it crosses the
 * bridge: backslashes → `/`, collapse duplicate separators, resolve
 * no-op `.` segments, strip any leading `/`. Returns null when the path
 * is empty, absolute, or escapes the root via `..` — mirroring the
 * rejection the Rust guard applies, so bad paths fail fast in the UI.
 */
export function normalizeRelPath(rel: string): string | null {
  if (typeof rel !== "string" || rel.length === 0) return null
  const unified = rel.replace(/\\/g, "/")
  if (unified.startsWith("/")) return null
  const parts: string[] = []
  for (const seg of unified.split("/")) {
    if (seg === "" || seg === ".") continue
    if (seg === "..") return null
    parts.push(seg)
  }
  return parts.length > 0 ? parts.join("/") : null
}

/** Case-insensitive `.md` filename check, mirroring the Rust filter. */
export function isMarkdownPath(path: string): boolean {
  return /\.md$/i.test(path)
}

/**
 * Filter a flat list of relative paths down to the markdown files the
 * Rust scanner would return. Paths are normalized first; un-normalizable
 * entries are dropped.
 */
export function filterMarkdownPaths(paths: string[]): string[] {
  return paths
    .map(normalizeRelPath)
    .filter((p): p is string => p !== null && isMarkdownPath(p))
}

/** Case-insensitive substring check for markdown content. */
export function isMarkdownFile(entry: FileEntry): boolean {
  return isMarkdownPath(entry.path)
}

export interface TreeNode {
  /** Path segment, e.g. "projects" or "note.md". */
  name: string
  /** Full relative path from the notes root, posix-style. */
  path: string
  /** Present only for file nodes. */
  entry?: FileEntry
  children?: TreeNode[]
}

/**
 * Build a nested folder/file tree from a flat list of FileEntry items
 * (as returned by listMarkdown). Folders sort before files, then both
 * alphabetically by name. Pure; does not touch Tauri.
 */
export function buildTree(entries: FileEntry[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const entry of entries) {
    const parts = entry.path.split("/")
    let level = root
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i]
      const path = parts.slice(0, i + 1).join("/")
      const isLeaf = i === parts.length - 1
      // Match a node of the same kind: folders have no `entry`, files do.
      let node = level.find(
        (n) => n.name === name && isLeaf === (n.entry !== undefined),
      )
      if (!node) {
        node = isLeaf
          ? { name, path, entry }
          : { name, path, children: [] }
        level.push(node)
      }
      if (!isLeaf) {
        node.children = node.children ?? []
        level = node.children
      }
    }
  }

  const sortLevel = (nodes: TreeNode[]): void => {
    nodes.sort((a, b) => {
      // Folders (no entry) before files.
      const aDir = a.entry === undefined ? 0 : 1
      const bDir = b.entry === undefined ? 0 : 1
      if (aDir !== bDir) return aDir - bDir
      return a.name.localeCompare(b.name)
    })
    for (const n of nodes) if (n.children) sortLevel(n.children)
  }
  sortLevel(root)
  return root
}

/**
 * Native-folder API backed by the Tauri fs commands. Every method uses
 * safeInvoke, so in the browser they reject with BrowserBridgeError —
 * callers (or a higher-level storage provider) decide on a web fallback.
 *
 * `pickDirectory` delegates to the existing dialog.ts picker
 * (tauri-plugin-dialog) so there is exactly one folder-picking code path.
 */
export const tauriFolder = {
  pickDirectory,

  /** Recursively list every .md note under `dir`. */
  async listMarkdown(dir: string): Promise<FileEntry[]> {
    const dtos = await safeInvoke<FileEntryDto[]>("fs_list_markdown", { dir })
    return dtos.map(dtoToFileEntry)
  },

  /** Read one note. Returns null when the path fails normalization. */
  async readFile(dir: string, rel: string): Promise<FileEntry | null> {
    const path = normalizeRelPath(rel)
    if (!path) return null
    const dto = await safeInvoke<FileEntryDto>("fs_read_file", {
      dir,
      relPath: path,
    })
    return dtoToFileEntry(dto)
  },

  /** Write a note, creating parent folders. Returns the fresh entry. */
  async writeFile(
    dir: string,
    rel: string,
    content: string,
  ): Promise<FileEntry | null> {
    const path = normalizeRelPath(rel)
    if (!path) return null
    const dto = await safeInvoke<FileEntryDto>("fs_write_file", {
      dir,
      relPath: path,
      content,
    })
    return dtoToFileEntry(dto)
  },

  /** Delete a note; true when the call succeeded (missing file counts). */
  async deleteFile(dir: string, rel: string): Promise<boolean> {
    const path = normalizeRelPath(rel)
    if (!path) return false
    await safeInvoke<void>("fs_delete_file", { dir, relPath: path })
    return true
  },
}

export type TauriFolderAPI = typeof tauriFolder
