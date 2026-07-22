"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Trash2, Search } from "lucide-react"
import type { LocalFile } from "@/core/db/schema"

interface SidebarProps {
  files: LocalFile[]
  activeFile: string | null
  onSelect: (path: string) => void
  onCreate: () => void
  onDelete: (path: string) => void
}

export function Sidebar({
  files,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[292px] shrink-0 flex-col border-r bg-sidebar transition-colors duration-300">
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          Files
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCreate}
          className="h-7 w-7 p-0 opacity-60 transition-opacity hover:opacity-100"
          title="New file (Ctrl+N)"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-1 p-2">
          {files.length === 0 && (
            <div className="px-2 py-8 text-center text-sm text-muted-foreground">
              No notes yet.
            </div>
          )}
          {files.map((file) => {
            const isActive = activeFile === file.path
            return (
              <div
                key={file.path}
                onClick={() => onSelect(file.path)}
                className={`group flex min-h-9 cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-accent/60"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <FileText
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-sidebar-primary" : "text-muted-foreground"}`}
                  />
                  <span className="truncate leading-5">{file.path}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(file.path)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          <span>Press Ctrl+K to search files</span>
        </div>
      </div>
    </aside>
  )
}
