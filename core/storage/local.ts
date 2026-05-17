import type { StorageProvider, StorageCapabilities, FileEntry } from "./types"
import { db } from "../db/schema"

export class LocalProvider implements StorageProvider {
  readonly id = "local"
  readonly name = "Just this browser"
  readonly capabilities: StorageCapabilities = {
    versionHistory: false,
    binaryFiles: false,
    folders: true,
    batchWrite: false,
  }

  isConnected(): boolean {
    return true
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}

  async listFiles(): Promise<FileEntry[]> {
    const files = await db.files.toArray()
    return files.map((f) => ({
      path: f.path,
      content: f.content,
      lastModified: f.lastModified,
    }))
  }

  async readFile(path: string): Promise<FileEntry | null> {
    const file = await db.files.get(path)
    if (!file) return null
    return {
      path: file.path,
      content: file.content,
      lastModified: file.lastModified,
    }
  }

  async writeFile(path: string, content: string): Promise<FileEntry> {
    const now = new Date()
    await db.files.put({
      path,
      content,
      lastModified: now,
      synced: true,
      syncPending: false,
    })
    return { path, content, lastModified: now }
  }

  async deleteFile(path: string): Promise<void> {
    await db.files.delete(path)
  }
}
