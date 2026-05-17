"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Trash2 } from "lucide-react"
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
    <div className="flex w-[260px] flex-col border-r bg-sidebar transition-colors duration-300">
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
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

      <ScrollArea className="flex-1">
        <div className="p-1.5">
          {files.map((file) => {
            const isActive = activeFile === file.path
            return (
              <div
                key={file.path}
                onClick={() => onSelect(file.path)}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-[6px] text-sm transition-all duration-150 ${
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-sidebar-foreground hover:bg-accent/60"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText
                    className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-sidebar-primary" : "text-muted-foreground"}`}
                  />
                  <span className="truncate">{file.path}</span>
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
    </div>
  )
}
