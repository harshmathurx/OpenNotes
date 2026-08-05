"use client"

import { useCallback, useEffect, useState } from "react"
import {
  FileSystemProvider,
  type FsPermissionState,
} from "@/core/storage/filesystem"
import {
  clearDirectoryHandle,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from "@/core/storage/dirHandleStore"
import type { FileEntry } from "@/core/storage/types"

const UNSUPPORTED_ERROR =
  "Your browser doesn't support opening folders. Try Chrome/Edge or the Mac app."

export interface UseFilesystemResult {
  /** True when the File System Access API is available (Chrome/Edge). */
  supported: boolean
  /** True when a folder is open and readwrite permission is granted. */
  connected: boolean
  /** Name of the opened folder (or the persisted one awaiting reconnect). */
  dirName: string | null
  /** Permission of the active/persisted handle, "unknown" when none. */
  permissionState: FsPermissionState
  /** Honest, user-facing error. Null when everything is fine. */
  error: string | null
  /** Opens the directory picker, persists the handle. User gesture required. */
  connect(): Promise<boolean>
  /** Re-requests permission on the persisted handle. User gesture required. */
  reconnect(): Promise<boolean>
  /** Disconnects and clears the persisted handle. */
  disconnect(): Promise<void>
  /**
   * Recursively lists every .md file under the opened folder.
   * READ-PURE: returns entries only; it does NOT write to the vault.
   * The caller reconciles entries with the vault (import/diff/merge).
   */
  readAllFromDisk(): Promise<FileEntry[]>
  /** Writes content to disk, creating parent directories as needed. */
  writeToDisk(path: string, content: string): Promise<FileEntry | null>
  /** Deletes from disk; tolerates a missing file. */
  deleteFromDisk(path: string): Promise<boolean>
}

function isFileSystemAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window
}

/**
 * First-class "Open a folder" hook for local markdown directories.
 *
 * Flow:
 * - connect(): user picks a folder, the handle is persisted to IndexedDB
 *   (core/storage/dirHandleStore.ts), state becomes connected.
 * - On mount the persisted handle is restored and its permission queried
 *   without prompting. "granted" → silent auto-reconnect (connected=true).
 *   "prompt" → connected stays false, permissionState="prompt", dirName is
 *   set so the UI can offer one-click "Reconnect to <dirName>"; reconnect()
 *   MUST be triggered by a user gesture.
 * - disconnect(): drops the handle and clears persistence.
 *
 * The hook never throws from restore/connect/reconnect; failures land in
 * the error state with details in console.error.
 */
export function useFilesystem(): UseFilesystemResult {
  const [supported] = useState<boolean>(isFileSystemAccessSupported)
  const [connected, setConnected] = useState(false)
  const [dirName, setDirName] = useState<string | null>(null)
  const [permissionState, setPermissionState] =
    useState<FsPermissionState>("unknown")
  const [error, setError] = useState<string | null>(null)

  // One provider per hook instance; state lives in useState, so a lazy
  // useState initializer keeps the provider stable across renders without
  // touching refs during render.
  const [provider] = useState(() => new FileSystemProvider())

  // Restore persisted handle on mount. Never throws.
  useEffect(() => {
    if (!supported) return
    let cancelled = false

    async function restore() {
      const stored = await loadDirectoryHandle()
      if (cancelled || !stored) return

      provider.setDirectoryHandle(stored.handle)
      const state = await provider.queryPermissionState()
      if (cancelled) return

      setDirName(stored.handle.name ?? stored.dirName ?? null)
      setPermissionState(state)

      if (state === "granted") {
        // Silent auto-reconnect: no user gesture needed.
        setConnected(true)
        setError(null)
      } else if (state === "prompt") {
        // Honest state: UI should offer "Reconnect to <dirName>".
        setConnected(false)
      } else if (state === "denied") {
        setConnected(false)
        setError(
          "Permission to this folder was denied. Reconnect and allow access."
        )
      }
    }

    void restore()
    return () => {
      cancelled = true
    }
  }, [provider, supported])

  const connect = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError(UNSUPPORTED_ERROR)
      return false
    }

    try {
      await provider.connect()
    } catch (e) {
      // Picker failure other than user-abort (abort returns silently).
      console.error("[useFilesystem] connect failed", e)
      setError("Could not open the folder picker. Try again.")
      return false
    }

    const handle = provider.getDirectoryHandle()
    if (!handle) {
      // User cancelled the picker: not an error.
      return false
    }

    await saveDirectoryHandle(handle)
    // The picker was opened with mode:"readwrite" and the user picked a
    // folder, so permission is granted at this point even in browsers
    // without queryPermission ("unknown" → treat as granted).
    const state = await provider.queryPermissionState()
    setDirName(handle.name)
    setPermissionState(state === "unknown" ? "granted" : state)
    setConnected(true)
    setError(null)
    return true
  }, [provider, supported])

  const reconnect = useCallback(async (): Promise<boolean> => {
    if (!supported) {
      setError(UNSUPPORTED_ERROR)
      return false
    }

    if (!provider.isConnected()) {
      // Nothing in memory: try the persisted handle first.
      const stored = await loadDirectoryHandle()
      if (!stored) {
        setError("No folder to reconnect to. Open a folder instead.")
        return false
      }
      provider.setDirectoryHandle(stored.handle)
      setDirName(stored.handle.name ?? stored.dirName ?? null)
    }

    // requestPermission requires a user gesture: callers must wire this
    // to a click. ensurePermission short-circuits when already granted.
    const granted = await provider.ensurePermission()
    const state = await provider.queryPermissionState()
    setPermissionState(state)

    if (!granted) {
      setConnected(false)
      setError(
        state === "denied"
          ? "Permission to this folder was denied. Allow access in the browser prompt."
          : "Permission was not granted. Try again."
      )
      return false
    }

    setConnected(true)
    setError(null)
    return true
  }, [provider, supported])

  const disconnect = useCallback(async (): Promise<void> => {
    await provider.disconnect()
    await clearDirectoryHandle()
    setConnected(false)
    setDirName(null)
    setPermissionState("unknown")
    setError(null)
  }, [provider])

  const readAllFromDisk = useCallback(async (): Promise<FileEntry[]> => {
    if (!provider.isConnected()) {
      setError("No folder is open.")
      return []
    }
    const state = await provider.queryPermissionState()
    setPermissionState(state)
    if (state !== "granted") {
      setConnected(false)
      setError("Folder access needs to be re-granted. Reconnect to continue.")
      return []
    }
    // Read-pure by design: FileSystemProvider.listFiles never mutates the
    // vault; reconciliation is the caller's job.
    const entries = await provider.listFiles()
    return entries
  }, [provider])

  const writeToDisk = useCallback(
    async (path: string, content: string): Promise<FileEntry | null> => {
      if (!provider.isConnected()) {
        setError("No folder is open.")
        return null
      }
      try {
        const entry = await provider.writeFile(path, content)
        setError(null)
        return entry
      } catch (e) {
        console.error(`[useFilesystem] writeToDisk failed for ${path}`, e)
        setError(`Could not write "${path}" to disk. Check folder permission.`)
        return null
      }
    },
    [provider]
  )

  const deleteFromDisk = useCallback(
    async (path: string): Promise<boolean> => {
      if (!provider.isConnected()) {
        setError("No folder is open.")
        return false
      }
      try {
        await provider.deleteFile(path)
        // Confirm deletion so callers get an honest boolean.
        const stillThere = await provider.readFile(path)
        if (stillThere) return false
        setError(null)
        return true
      } catch (e) {
        console.error(`[useFilesystem] deleteFromDisk failed for ${path}`, e)
        setError(`Could not delete "${path}" from disk.`)
        return false
      }
    },
    [provider]
  )

  return {
    supported,
    connected,
    dirName,
    permissionState,
    error,
    connect,
    reconnect,
    disconnect,
    readAllFromDisk,
    writeToDisk,
    deleteFromDisk,
  }
}
