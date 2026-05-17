"use client"

import { useState, useCallback } from "react"
import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/core/db/schema"

export function useVault() {
  const files = useLiveQuery(() => db.files.orderBy("path").toArray(), []) ?? []
  const [activeFile, setActiveFile] = useState<string | null>(null)

  const createFile = useCallback(async (name: string) => {
    const path = name.endsWith(".md") ? name : `${name}.md`
    await db.files.put({
      path,
      content: "",
      lastModified: new Date(),
      synced: true,
      syncPending: false,
    })
    setActiveFile(path)
    return path
  }, [])

  const saveFile = useCallback(async (path: string, content: string) => {
    await db.files.put({
      path,
      content,
      lastModified: new Date(),
      synced: false,
      syncPending: true,
    })
  }, [])

  const deleteFile = useCallback(
    async (path: string) => {
      await db.files.delete(path)
      if (activeFile === path) setActiveFile(null)
    },
    [activeFile]
  )

  return { files, activeFile, setActiveFile, createFile, saveFile, deleteFile }
}
