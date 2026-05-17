"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, FileText } from "lucide-react"
import type { LocalFile } from "@/core/db/schema"

interface SidebarProps {
  files: LocalFile[]
  activeFile: string | null
  onSelect: (path: string) => void
  onCreate: (name: string) => Promise<string>
  onDelete: (path: string) => Promise<void>
}

export function Sidebar({
  files,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  const handleCreate = async () => {
    const name = prompt("File name:")
    if (name) await onCreate(name)
  }

  const handleDelete = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    if (confirm(`Delete ${path}?`)) {
      await onDelete(path)
    }
  }

  return (
    <div className="flex w-64 flex-col border-r bg-background">
      <div className="flex items-center justify-between border-b p-3">
        <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Files
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCreate}
          className="h-7 w-7 p-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {files.map((file) => (
            <div
              key={file.path}
              onClick={() => onSelect(file.path)}
              className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
                activeFile === file.path
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{file.path}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => handleDelete(e, file.path)}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </Button>
            </div>
          ))}
          {files.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No files yet
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
