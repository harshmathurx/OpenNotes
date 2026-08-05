import Dexie, { type Table } from "dexie"

/**
 * IndexedDB persistence for FileSystemDirectoryHandle.
 *
 * File System Access handles are structured-cloneable, so Chromium lets us
 * stash the picked directory handle in IndexedDB and resurrect it after a
 * reload. Permissions are NOT persisted the same way: a restored handle may
 * come back with permissionState "prompt", in which case the user must
 * re-grant access via a user gesture (see hooks/useFilesystem.ts).
 *
 * This follows the Dexie pattern used by core/db/schema.ts, kept in a
 * separate database so vault data and session-level folder handles can
 * evolve independently.
 */

export const DIRECTORY_HANDLE_KEY = "active-directory"

export interface StoredDirectoryHandle {
  key: string
  handle: FileSystemDirectoryHandle
  /** Picker-reported folder name, duplicated for fast UI access. */
  dirName: string
  storedAt: Date
}

export class DirHandleDB extends Dexie {
  directoryHandles!: Table<StoredDirectoryHandle>

  constructor() {
    super("opennotes-dir-handles")
    this.version(1).stores({
      directoryHandles: "key",
    })
  }
}

export const dirHandleDb = new DirHandleDB()

/**
 * Persists the handle. Never throws: persistence failure must not break
 * an otherwise successful connect.
 */
export async function saveDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<boolean> {
  try {
    await dirHandleDb.directoryHandles.put({
      key: DIRECTORY_HANDLE_KEY,
      handle,
      dirName: handle.name,
      storedAt: new Date(),
    })
    return true
  } catch (e) {
    console.error("[dirHandleStore] Failed to persist directory handle", e)
    return false
  }
}

/**
 * Restores the persisted handle, or null when none is stored or the read
 * fails. Never throws.
 */
export async function loadDirectoryHandle(): Promise<StoredDirectoryHandle | null> {
  try {
    const record = await dirHandleDb.directoryHandles.get(DIRECTORY_HANDLE_KEY)
    if (!record?.handle) return null
    return record
  } catch (e) {
    console.error("[dirHandleStore] Failed to restore directory handle", e)
    return null
  }
}

/** Clears the persisted handle. Never throws. */
export async function clearDirectoryHandle(): Promise<void> {
  try {
    await dirHandleDb.directoryHandles.delete(DIRECTORY_HANDLE_KEY)
  } catch (e) {
    console.error("[dirHandleStore] Failed to clear directory handle", e)
  }
}
