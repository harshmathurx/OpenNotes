"use client"

import { useState, useCallback, useEffect } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/core/db/schema"
import {
  deleteVaultFile,
  renameVaultFile,
  saveVaultFile,
} from "@/core/vault/mutations"

const STORAGE_KEY = "opennotes-active-file"

interface UseVaultOptions {
  remoteActive?: boolean
}

export function useVault(options: UseVaultOptions = {}) {
  const files = useLiveQuery(() => db.files.orderBy("path").toArray(), []) ?? []
  const [activeFile, setActiveFileState] = useState<string | null>(null)
  const remoteActive = options.remoteActive ?? false

  // Persist active file
  useEffect(() => {
    if (activeFile) {
      localStorage.setItem(STORAGE_KEY, activeFile)
    }
  }, [activeFile])

  // Restore active file on mount, or auto-select most recent
  useEffect(() => {
    if (files.length === 0) return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && files.some((f) => f.path === saved)) {
      setActiveFileState(saved)
    } else {
      // Auto-select most recently modified file
      const mostRecent = [...files].sort(
        (a, b) => b.lastModified.getTime() - a.lastModified.getTime()
      )[0]
      if (mostRecent) setActiveFileState(mostRecent.path)
    }
  }, [files.length > 0])

  const setActiveFile = useCallback((path: string | null) => {
    setActiveFileState(path)
    if (path) {
      localStorage.setItem(STORAGE_KEY, path)
    }
  }, [])

  const createFile = useCallback(
    async (name?: string) => {
      const path = name?.endsWith(".md") ? name : `${name ?? "Untitled"}.md`
      // Ensure unique name
      let uniquePath = path
      let counter = 1
      while (files.some((f) => f.path === uniquePath)) {
        const base = path.replace(/\.md$/, "")
        uniquePath = `${base} ${counter}.md`
        counter++
      }
      await db.files.put({
        path: uniquePath,
        content: "",
        lastModified: new Date(),
        synced: true,
        syncPending: false,
      })
      setActiveFileState(uniquePath)
      return uniquePath
    },
    [files]
  )

  const saveFile = useCallback(
    async (path: string, content: string) => {
      await saveVaultFile(path, content, remoteActive)
    },
    [remoteActive]
  )

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const target = await renameVaultFile(oldPath, newPath, remoteActive)
      if (target && activeFile === oldPath) {
        setActiveFileState(target)
      }
    },
    [activeFile, remoteActive]
  )

  const deleteFile = useCallback(
    async (path: string) => {
      await deleteVaultFile(path, remoteActive)
      if (activeFile === path) {
        const remaining = files.filter((f) => f.path !== path)
        const next = remaining[0]?.path ?? null
        setActiveFileState(next)
        if (next) localStorage.setItem(STORAGE_KEY, next)
      }
    },
    [activeFile, files, remoteActive]
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
