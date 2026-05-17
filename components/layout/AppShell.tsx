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
import { Button } from "@/components/ui/button"
import { Plus, FileText, Sparkles } from "lucide-react"

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

  const handleCreate = useCallback(async () => {
    const name = prompt("File name:")
    if (name) await createFile(name)
  }, [createFile])

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? ""

  // Empty state — first run
  if (files.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background transition-colors duration-300">
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800">
            <FileText className="h-6 w-6 text-stone-400 dark:text-stone-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-medium text-foreground">
              No files yet
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              Create your first note to get started. Everything is saved locally
              in your browser.
            </p>
          </div>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Create first file
          </Button>
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              Ctrl+N
            </kbd>{" "}
            anytime
          </p>
        </div>
      </div>
    )
  }

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

      {commandOpen && (
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          files={files}
          onSelectFile={setActiveFile}
          onCreateFile={createFile}
          onSync={handleSave}
        />
      )}

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
