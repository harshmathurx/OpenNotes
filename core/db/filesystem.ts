"use client"

import Dexie, { type Table } from "dexie"

export interface FileSystemHandleStore {
  key: string
  handle: FileSystemDirectoryHandle
}

export class FileSystemDB extends Dexie {
  handles!: Table<FileSystemHandleStore>

  constructor() {
    super("opennotes-filesystem-vault")
    this.version(1).stores({
      handles: "key",
    })
  }
}

export const fsDb = new FileSystemDB()

export async function saveStoredDirectoryHandle(handle: FileSystemDirectoryHandle) {
  try {
    await fsDb.handles.put({
      key: "active-directory",
      handle,
    })
  } catch (e) {
    console.error("Failed to save directory handle in IndexedDB", e)
  }
}

export async function getStoredDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const record = await fsDb.handles.get("active-directory")
    return record?.handle || null
  } catch (e) {
    console.error("Failed to fetch directory handle from IndexedDB", e)
    return null
  }
}

export async function clearStoredDirectoryHandle() {
  try {
    await fsDb.handles.delete("active-directory")
  } catch (e) {
    console.error("Failed to clear directory handle from IndexedDB", e)
  }
}
