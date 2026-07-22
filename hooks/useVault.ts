"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
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
  const liveFiles = useLiveQuery(() => db.files.orderBy("path").toArray(), [])
  const files = useMemo(() => liveFiles ?? [], [liveFiles])
  const remoteActive = options.remoteActive ?? false
  const [activeFileState, setActiveFileState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    return localStorage.getItem(STORAGE_KEY)
  })

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
    setActiveFileState(path)
  }, [])

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
