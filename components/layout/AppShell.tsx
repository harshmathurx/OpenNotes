"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { SyncStatusIndicator } from "./SyncStatus"
import { Editor } from "../editor/Editor"
import { CommandPalette } from "../palette/CommandPalette"
import { ConflictModal } from "../modals/ConflictModal"
import { useVault } from "@/hooks/useVault"
import { useSync } from "@/hooks/useSync"

export function AppShell() {
  const { files, activeFile, setActiveFile, createFile, saveFile, deleteFile } =
    useVault()
  const { status, unsyncedCount, flush } = useSync()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zenMode, setZenMode] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [conflict, setConflict] = useState<{
    path: string
    local: string
    remote: string
  } | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (
        e as CustomEvent<{ path: string; local: string; remote: string }>
      ).detail
      setConflict(detail)
    }
    window.addEventListener("sync-conflict", handler)
    return () => window.removeEventListener("sync-conflict", handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const handleSave = useCallback(() => {
    void flush()
  }, [flush])

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? ""

  return (
    <div className="flex h-screen bg-background">
      {!zenMode && sidebarOpen && (
        <Sidebar
          files={files}
          activeFile={activeFile}
          onSelect={setActiveFile}
          onCreate={createFile}
          onDelete={deleteFile}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!zenMode && (
          <TitleBar
            path={activeFile}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleZen={() => setZenMode(!zenMode)}
          >
            <SyncStatusIndicator
              status={status}
              count={unsyncedCount}
              onSync={handleSave}
            />
          </TitleBar>
        )}

        <div className="flex-1 overflow-hidden">
          <Editor
            content={activeContent}
            onChange={(content) => {
              if (activeFile) saveFile(activeFile, content)
            }}
            onSave={handleSave}
          />
        </div>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        files={files}
        onSelectFile={setActiveFile}
        onCreateFile={createFile}
        onSync={handleSave}
      />

      {conflict && (
        <ConflictModal
          open={!!conflict}
          path={conflict.path}
          localContent={conflict.local}
          remoteContent={conflict.remote}
          onResolve={(content) => {
            saveFile(conflict.path, content)
            void flush()
          }}
          onClose={() => setConflict(null)}
        />
      )}
    </div>
  )
}
