"use client"

import { useState, useEffect, useCallback } from "react"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { SyncStatusIndicator } from "./SyncStatus"
import { TiptapEditor } from "../editor/TiptapEditor"
import { CommandPalette } from "../palette/CommandPalette"
import { ConflictModal } from "../modals/ConflictModal"
import { useVault } from "@/hooks/useVault"
import { useSync } from "@/hooks/useSync"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Plus, FileText } from "lucide-react"

export function AppShell() {
  const {
    files,
    activeFile,
    setActiveFile,
    createFile,
    saveFile,
    renameFile,
    deleteFile,
  } = useVault()
  const { status, unsyncedCount, flush } = useSync()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
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
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
        e.preventDefault()
        setZenMode((prev) => !prev)
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault()
        void createFile()
        return
      }
      if (e.key === "Escape") {
        if (commandOpen) {
          setCommandOpen(false)
          return
        }
        if (zenMode) {
          setZenMode(false)
          return
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [commandOpen, zenMode, createFile])

  const handleSave = useCallback(() => {
    void flush()
  }, [flush])

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? ""

  if (files.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background transition-colors duration-300">
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
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
          <Button onClick={() => void createFile()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create first file
          </Button>
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              Ctrl+N
            </kbd>{" "}
            to create a file
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {!zenMode && sidebarOpen && (
        <div className="hidden md:block">
          <Sidebar
            files={files}
            activeFile={activeFile}
            onSelect={setActiveFile}
            onCreate={() => void createFile()}
            onDelete={(path) => void deleteFile(path)}
          />
        </div>
      )}

      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Files</SheetTitle>
          </SheetHeader>
          <Sidebar
            files={files}
            activeFile={activeFile}
            onSelect={(path) => {
              setActiveFile(path)
              setMobileSheetOpen(false)
            }}
            onCreate={() => {
              void createFile()
              setMobileSheetOpen(false)
            }}
            onDelete={(path) => void deleteFile(path)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {!zenMode && (
          <TitleBar
            path={activeFile}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleMobileSidebar={() => setMobileSheetOpen(true)}
            onToggleZen={() => setZenMode(true)}
            onRename={(newPath) => {
              if (activeFile) void renameFile(activeFile, newPath)
            }}
          >
            <SyncStatusIndicator
              status={status}
              count={unsyncedCount}
              onSync={handleSave}
            />
          </TitleBar>
        )}

        {zenMode && (
          <div className="absolute top-0 right-0 left-0 z-50 flex h-10 items-center justify-center opacity-0 transition-opacity duration-200 hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZenMode(false)}
              className="text-xs text-muted-foreground"
            >
              Exit zen mode
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-hidden">
          <TiptapEditor
            docKey={activeFile ?? "none"}
            content={activeContent}
            onChange={(content) => {
              if (activeFile) saveFile(activeFile, content)
            }}
            onSave={handleSave}
            onNavigate={setActiveFile}
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
