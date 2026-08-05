"use client"

import type { StorageProvider, StorageCapabilities, FileEntry } from "./types"

/** Directories that are never traversed when listing markdown files. */
export const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  ".git",
  ".obsidian",
  ".trash",
  "node_modules",
])

/** Upper bound on directory recursion depth. Guards against symlink cycles. */
export const MAX_SCAN_DEPTH = 8

/**
 * Permission state of the active directory handle. "unknown" covers a
 * missing handle or a browser without queryPermission.
 */
export type FsPermissionState = "granted" | "prompt" | "denied" | "unknown"

/** Case-insensitive check for markdown file extensions (.md / .markdown). */
export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown)$/i.test(name)
}

/** Joins a relative parent path with an entry name using "/" separators. */
export function joinPath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name
}

/** Splits a "/" separated vault path into non-empty segments. */
export function splitPath(path: string): string[] {
  return path.split("/").filter((part) => part.length > 0)
}

/** True when every segment is a plain (non-hidden) directory name. */
export function isTraversableDirectory(name: string): boolean {
  if (SKIPPED_DIRECTORIES.has(name)) return false
  if (name.startsWith(".")) return false
  return true
}

/**
 * StorageProvider backed by the browser File System Access API.
 *
 * The provider wraps a FileSystemDirectoryHandle. Handles are serializable
 * to IndexedDB (structured clone), so persistence lives in
 * core/storage/dirHandleStore.ts and is coordinated by hooks/useFilesystem.ts.
 *
 * Robustness notes:
 * - The provider never throws from read paths; failures are logged and the
 *   entry is skipped (listFiles) or null is returned (readFile).
 * - writeFile throws when disconnected so callers can surface an honest
 *   error; per-file write failures propagate after logging.
 * - deleteFile tolerates missing files and missing parent directories.
 */
export class FileSystemProvider implements StorageProvider {
  readonly id = "filesystem"
  readonly name = "Local Directory (Native Folder)"
  readonly capabilities: StorageCapabilities = {
    versionHistory: false,
    binaryFiles: false,
    folders: true,
    batchWrite: false,
  }

  private dirHandle: FileSystemDirectoryHandle | null = null

  constructor(dirHandle?: FileSystemDirectoryHandle) {
    if (dirHandle) {
      this.dirHandle = dirHandle
    }
  }

  setDirectoryHandle(handle: FileSystemDirectoryHandle) {
    this.dirHandle = handle
  }

  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.dirHandle
  }

  isConnected(): boolean {
    return this.dirHandle !== null
  }

  /**
   * Prompts the user to pick a directory (user gesture required) and adopts
   * the handle. User-abort is silent: no handle is set and no error thrown.
   * Throws when the File System Access API is unavailable.
   */
  async connect(): Promise<void> {
    if (this.dirHandle) return

    if (typeof window !== "undefined" && "showDirectoryPicker" in window) {
      try {
        const handle = await (
          window as unknown as {
            showDirectoryPicker: (opts?: {
              mode?: "read" | "readwrite"
            }) => Promise<FileSystemDirectoryHandle>
          }
        ).showDirectoryPicker({ mode: "readwrite" })
        this.dirHandle = handle
      } catch (e: unknown) {
        if (e instanceof DOMException && e.name === "AbortError") {
          // User cancelled the picker; leave disconnected without error.
          return
        }
        throw e
      }
    } else {
      throw new Error(
        "File System Access API is not supported in this browser."
      )
    }
  }

  async disconnect(): Promise<void> {
    this.dirHandle = null
  }

  /**
   * Queries the current permission state without prompting. Safe to call
   * on page load. Returns "granted" | "prompt" | "denied", or "unknown"
   * when no handle is present or the browser lacks queryPermission.
   */
  async queryPermissionState(): Promise<FsPermissionState> {
    if (!this.dirHandle) return "unknown"
    try {
      const queryable = this.dirHandle as FileSystemDirectoryHandle & {
        queryPermission?: (desc: {
          mode: "read" | "readwrite"
        }) => Promise<PermissionState>
      }
      if (typeof queryable.queryPermission !== "function") return "unknown"
      return await queryable.queryPermission({ mode: "readwrite" })
    } catch (e) {
      console.error("[filesystem] queryPermission failed", e)
      return "unknown"
    }
  }

  /**
   * Requests readwrite permission. MUST be called from a user gesture
   * (browser requirement). Returns true when granted.
   */
  async ensurePermission(): Promise<boolean> {
    if (!this.dirHandle) return false
    const state = await this.queryPermissionState()
    if (state === "granted") return true
    return this.requestPermissions()
  }

  /** Back-compat helper: true when readwrite permission is granted. */
  async checkPermissions(): Promise<boolean> {
    return (await this.queryPermissionState()) === "granted"
  }

  /** Back-compat helper: prompts for readwrite permission. */
  async requestPermissions(): Promise<boolean> {
    if (!this.dirHandle) return false
    try {
      const requestable = this.dirHandle as FileSystemDirectoryHandle & {
        requestPermission?: (desc: {
          mode: "read" | "readwrite"
        }) => Promise<PermissionState>
      }
      if (typeof requestable.requestPermission !== "function") return false
      const status = await requestable.requestPermission({
        mode: "readwrite",
      })
      return status === "granted"
    } catch (e) {
      console.error("[filesystem] requestPermission failed", e)
      return false
    }
  }

  /**
   * Lists every markdown file under the directory, recursively.
   * Skips hidden and tooling directories and stops at MAX_SCAN_DEPTH.
   * Read-only: never writes to disk or IndexedDB.
   */
  async listFiles(): Promise<FileEntry[]> {
    if (!this.dirHandle) return []
    const isGranted = await this.checkPermissions()
    if (!isGranted) return []

    return await this.getFilesRecursively(this.dirHandle, "", 0)
  }

  private async getFilesRecursively(
    dirHandle: FileSystemDirectoryHandle,
    relativeParentPath: string,
    depth: number
  ): Promise<FileEntry[]> {
    if (depth > MAX_SCAN_DEPTH) {
      console.warn(
        `[filesystem] Max depth ${MAX_SCAN_DEPTH} reached at "${relativeParentPath}"; skipping deeper entries.`
      )
      return []
    }

    const files: FileEntry[] = []
    const iterable = dirHandle as unknown as AsyncIterable<FileSystemHandle>

    for await (const entry of iterable) {
      const relativePath = joinPath(relativeParentPath, entry.name)

      try {
        if (entry.kind === "file") {
          if (!isMarkdownFile(entry.name)) continue
          const file = await (entry as FileSystemFileHandle).getFile()
          const content = await readFileAsText(file, relativePath)
          if (content === null) continue
          files.push({
            path: relativePath,
            content,
            lastModified: new Date(file.lastModified),
          })
        } else if (entry.kind === "directory") {
          if (!isTraversableDirectory(entry.name)) continue
          const subFiles = await this.getFilesRecursively(
            entry as FileSystemDirectoryHandle,
            relativePath,
            depth + 1
          )
          files.push(...subFiles)
        }
      } catch (e) {
        console.error(`[filesystem] Failed to read entry ${relativePath}`, e)
      }
    }
    return files
  }

  async readFile(path: string): Promise<FileEntry | null> {
    if (!this.dirHandle) return null
    try {
      const fileHandle = await this.getFileHandle(this.dirHandle, path)
      const file = await fileHandle.getFile()
      const content = await readFileAsText(file, path)
      if (content === null) return null
      return {
        path,
        content,
        lastModified: new Date(file.lastModified),
      }
    } catch (e) {
      console.error(`[filesystem] Failed to read file ${path}`, e)
      return null
    }
  }

  /**
   * Writes content to path, creating parent directories as needed.
   * Returns the FileEntry with the lastModified reported by the filesystem
   * after the write (re-reads the file for an accurate timestamp).
   * Throws when disconnected or when the write itself fails (callers
   * surface the error); a partially-open writable is always closed.
   */
  async writeFile(path: string, content: string): Promise<FileEntry> {
    if (!this.dirHandle) throw new Error("No folder opened.")

    const fileHandle = await this.getFileHandle(this.dirHandle, path, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    try {
      await writable.write(content)
    } finally {
      await writable.close()
    }

    const file = await fileHandle.getFile()
    return {
      path,
      content,
      lastModified: new Date(file.lastModified),
    }
  }

  /**
   * Removes the entry at path. Tolerates a missing file or missing parent
   * directory (NotFoundError is treated as already-deleted). Returns true
   * when the path is gone afterwards, false on other failures.
   */
  async deleteFile(path: string): Promise<void> {
    if (!this.dirHandle) return
    try {
      const parts = splitPath(path)
      const fileName = parts.pop()
      if (!fileName) return
      let currentDir = this.dirHandle

      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part)
      }

      await currentDir.removeEntry(fileName)
    } catch (e) {
      if (e instanceof DOMException && e.name === "NotFoundError") {
        // Already gone; deletion is idempotent.
        return
      }
      console.error(`[filesystem] Failed to delete file ${path}`, e)
    }
  }

  private async getFileHandle(
    dirHandle: FileSystemDirectoryHandle,
    path: string,
    options?: FileSystemGetFileOptions
  ): Promise<FileSystemFileHandle> {
    const parts = splitPath(path)
    const fileName = parts.pop()
    if (!fileName) throw new Error(`Invalid file path: "${path}"`)
    let currentDir = dirHandle

    for (const part of parts) {
      currentDir = await currentDir.getDirectoryHandle(part, {
        create: options?.create ?? false,
      })
    }

    return await currentDir.getFileHandle(fileName, options)
  }
}

/**
 * Reads a File as UTF-8 text. Returns null (and logs) for binary or
 * non-decodable content so callers can skip it gracefully.
 */
async function readFileAsText(file: File, label: string): Promise<string | null> {
  try {
    return await file.text()
  } catch (e) {
    console.error(`[filesystem] Skipping unreadable/non-text file ${label}`, e)
    return null
  }
}
