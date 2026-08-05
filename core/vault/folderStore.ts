import { tauriFolder, type TauriFolderAPI } from "@/core/bridge/fs"
import { isTauri } from "@/core/bridge/runtime"
import type { FileEntry, StorageCapabilities, StorageProvider } from "@/core/storage/types"
import { getNotesFolder, setNotesFolder } from "@/core/vault/notesFolder"

/**
 * FolderVaultStore — a StorageProvider whose source of truth is the notes
 * folder on disk, backed by the Tauri fs bridge (core/bridge/fs.ts).
 *
 * This is the desktop (Tauri) provider: when it is connected, the notes
 * folder IS the vault — the disk is the single source of truth and git
 * watches the same folder, so "Commit" sees exactly what the user typed.
 * In a plain browser isConnected() is false and the app falls back to the
 * IndexedDB provider.
 *
 * The store is PURE DISK: it never touches IndexedDB. Any cache/reconcile
 * layer is a separate concern; this is the disk primitive behind the
 * existing StorageProvider contract.
 *
 * The folder-api is injectable (defaults to tauriFolder) so tests can mock
 * the bridge without a Tauri runtime.
 */
export class FolderVaultStore implements StorageProvider {
  readonly id = "folder"
  readonly name = "Notes folder"
  readonly capabilities: StorageCapabilities = {
    versionHistory: false,
    binaryFiles: false,
    folders: true,
    batchWrite: false,
  }

  private folderPath: string | null
  private readonly fs: TauriFolderAPI

  constructor(folderPath?: string | null, fs: TauriFolderAPI = tauriFolder) {
    // An explicit constructor arg wins; otherwise hydrate from the shared
    // notes-folder source of truth so the store tracks the user's folder.
    this.folderPath = folderPath !== undefined ? folderPath : getNotesFolder()
    this.fs = fs
  }

  /** Connected only with a folder path AND a real Tauri runtime. */
  isConnected(): boolean {
    return this.folderPath !== null && isTauri()
  }

  /**
   * Ensure a folder is selected. When no path is set, open the native
   * directory picker and persist the choice via the shared notes-folder
   * source of truth (so vault + git stay on the same folder). User cancel
   * leaves the store disconnected.
   */
  async connect(): Promise<void> {
    if (this.folderPath) return
    const selected = await this.fs.pickDirectory()
    if (!selected) return
    this.folderPath = selected
    setNotesFolder(selected)
  }

  async disconnect(): Promise<void> {
    // The store does not own the shared notes-folder setting; dropping the
    // local path disconnects this provider without clearing the user's
    // folder for git/settings.
    this.folderPath = null
  }

  /** The folder this store is bound to, or null when unbound. */
  getFolderPath(): string | null {
    return this.folderPath
  }

  private requireDir(): string {
    if (!this.folderPath) {
      throw new Error(
        "No notes folder is open. Pick a folder to use the desktop vault."
      )
    }
    return this.folderPath
  }

  async listFiles(): Promise<FileEntry[]> {
    const dir = this.requireDir()
    try {
      return await this.fs.listMarkdown(dir)
    } catch (e) {
      throw new Error(`Could not list notes in "${dir}": ${toMessage(e)}`)
    }
  }

  async readFile(path: string): Promise<FileEntry | null> {
    const dir = this.requireDir()
    try {
      return await this.fs.readFile(dir, path)
    } catch (e) {
      throw new Error(`Could not read "${path}": ${toMessage(e)}`)
    }
  }

  /**
   * Write a note to disk (the bridge creates parent folders, so there is no
   * partial state). Returns the fresh entry with the post-write lastModified.
   */
  async writeFile(path: string, content: string): Promise<FileEntry> {
    const dir = this.requireDir()
    try {
      const entry = await this.fs.writeFile(dir, path, content)
      if (!entry) {
        throw new Error(`Invalid note path "${path}".`)
      }
      return entry
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Invalid note path")) throw e
      throw new Error(`Could not write "${path}": ${toMessage(e)}`)
    }
  }

  async deleteFile(path: string): Promise<void> {
    const dir = this.requireDir()
    try {
      const ok = await this.fs.deleteFile(dir, path)
      if (!ok) throw new Error(`Invalid note path "${path}".`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Invalid note path")) throw e
      throw new Error(`Could not delete "${path}": ${toMessage(e)}`)
    }
  }
}

function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}
