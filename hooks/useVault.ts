"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/core/db/schema"
import { isTauri } from "@/core/bridge/runtime"
import {
  deleteVaultFile,
  flushAllVaultSaves,
  flushVaultSave,
  renameVaultFile,
  saveVaultFile,
  type VaultBackend,
} from "@/core/vault/mutations"
import { FolderVaultStore } from "@/core/vault/folderStore"
import {
  getNotesFolder,
  onNotesFolderChange,
} from "@/core/vault/notesFolder"
import { reconcileFromDisk } from "@/core/vault/diskMirror"

const STORAGE_KEY = "opennotes-active-file"

export function useVault() {
  const liveFiles = useLiveQuery(() => db.files.orderBy("path").toArray(), [])
  const files = useMemo(() => liveFiles ?? [], [liveFiles])
  const [activeFileState, setActiveFileState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(STORAGE_KEY)
  })

  // Track the notes folder reactively so the vault switches between the
  // on-disk backend and IndexedDB-only mode without a reload.
  const [notesFolder, setNotesFolderState] = useState<string | null>(() =>
    getNotesFolder()
  )
  useEffect(() => onNotesFolderChange(setNotesFolderState), [])

  const diskActive = isTauri() && notesFolder !== null

  const backend = useMemo<VaultBackend | undefined>(
    () => (diskActive ? new FolderVaultStore(notesFolder) : undefined),
    [diskActive, notesFolder]
  )

  const activeFile = useMemo(() => {
    if (activeFileState && files.some((f) => f.path === activeFileState)) {
      return activeFileState
    }

    const mostRecent = [...files].sort(
      (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
    )[0]
    return mostRecent?.path ?? null
  }, [activeFileState, files])

  useEffect(() => {
    if (activeFile) {
      localStorage.setItem(STORAGE_KEY, activeFile)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [activeFile])

  const setActiveFile = useCallback((path: string | null) => {
    setActiveFileState((prev) => {
      // Note-switch flush: land the outgoing note's queued writes before the
      // editor swaps content, so a fast switch can't lose or reorder saves.
      if (prev && prev !== path) void flushVaultSave(prev)
      return path
    })
  }, [])

  // Unmount flush: nothing typed in this session may be lost when the vault
  // goes away (route change, app close).
  useEffect(() => {
    return () => {
      void flushAllVaultSaves()
    }
  }, [])

  // Reconcile-on-launch: once per folder, merge the disk state into the
  // cache so external edits appear. Guarded by a ref keyed on the folder
  // path so it never loops; re-runs only when the folder changes.
  const reconciledForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!diskActive || !notesFolder) {
      reconciledForRef.current = null
      return
    }
    if (reconciledForRef.current === notesFolder) return
    reconciledForRef.current = notesFolder

    let cancelled = false
    const store = new FolderVaultStore(notesFolder)
    store
      .listFiles()
      .then((entries) =>
        cancelled ? undefined : reconcileFromDisk(entries, store)
      )
      .catch(() => {
        // Disk unavailable (permissions, folder moved) — the cache-only
        // vault keeps working; retry next time the folder changes.
        reconciledForRef.current = null
      })
    return () => {
      cancelled = true
    }
  }, [diskActive, notesFolder])

  const createFile = useCallback(
    async (name?: string) => {
      const path = name?.endsWith(".md") ? name : `${name ?? "Untitled"}.md`
      let uniquePath = path
      let counter = 1
      while (files.some((f) => f.path === uniquePath)) {
        const base = path.replace(/\.md$/, "")
        uniquePath = `${base} ${counter}.md`
        counter++
      }
      if (backend) {
        // Write the empty note to disk first so it exists as a real .md
        // immediately, then mirror into the cache.
        await saveVaultFile(uniquePath, "", backend)
      } else {
        await db.files.put({
          path: uniquePath,
          content: "",
          lastModified: new Date(),
          synced: true,
          syncPending: false,
        })
      }
      setActiveFileState(uniquePath)
      return uniquePath
    },
    [files, backend]
  )

  const saveFile = useCallback(
    async (path: string, content: string) => {
      await saveVaultFile(path, content, backend)
    },
    [backend]
  )

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const target = await renameVaultFile(oldPath, newPath, backend)
      if (target && activeFile === oldPath) {
        setActiveFileState(target)
      }
    },
    [activeFile, backend]
  )

  const deleteFile = useCallback(
    async (path: string) => {
      await deleteVaultFile(path, backend)
      if (activeFile === path) {
        const remaining = files.filter((f) => f.path !== path)
        const next = remaining[0]?.path ?? null
        setActiveFileState(next)
      }
    },
    [activeFile, files, backend]
  )

  return {
    files,
    activeFile,
    setActiveFile,
    createFile,
    saveFile,
    renameFile,
    deleteFile,
  }
}
