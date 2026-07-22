"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/core/db/schema"

const STORAGE_KEY = "opennotes-active-file"

export function useVault() {
  const liveFiles = useLiveQuery(() => db.files.orderBy("path").toArray(), [])
  const files = useMemo(() => liveFiles ?? [], [liveFiles])
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

  // Persist active file
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

  const saveFile = useCallback(async (path: string, content: string) => {
    await db.files.put({
      path,
      content,
      lastModified: new Date(),
      synced: true,
      syncPending: false,
    })
  }, [])

  const renameFile = useCallback(
    async (oldPath: string, newPath: string) => {
      const target = newPath.endsWith(".md") ? newPath : `${newPath}.md`
      if (target === oldPath) return
      const file = await db.files.get(oldPath)
      if (!file) return
      await db.files.delete(oldPath)
      await db.files.put({ ...file, path: target, lastModified: new Date() })
      if (activeFile === oldPath) {
        setActiveFileState(target)
      }
    },
    [activeFile]
  )

  const deleteFile = useCallback(
    async (path: string) => {
      await db.files.delete(path)
      if (activeFile === path) {
        const remaining = files.filter((f) => f.path !== path)
        const next = remaining[0]?.path ?? null
        setActiveFileState(next)
      }
    },
    [activeFile, files]
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
