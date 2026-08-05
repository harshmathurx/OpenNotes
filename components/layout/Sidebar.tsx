"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, FileText, Trash2, Search, Home } from "lucide-react"
import type { LocalFile } from "@/core/db/schema"
import { FolderSwitcher } from "./FolderSwitcher"

interface SidebarProps {
  files: LocalFile[]
  activeFile: string | null
  onSelect: (path: string) => void
  onCreate: () => void
  onDelete: (path: string) => void
  onOpenHome?: () => void
  isHomeActive?: boolean
}

export function Sidebar({
  files,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
  onOpenHome,
  isHomeActive,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-[292px] shrink-0 flex-col border-r border-sidebar-border/70 bg-sidebar transition-colors duration-300">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-sidebar-border/70 px-4">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground/90 uppercase">
          Files
        </span>
        <div className="flex items-center gap-0.5">
          <FolderSwitcher />
          {onOpenHome && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenHome}
              className={`h-7 w-7 p-0 transition-all hover:text-foreground ${
                isHomeActive ? "text-foreground" : "text-muted-foreground/70"
              }`}
              title="Workspace home (Ctrl+Shift+H)"
            >
              <Home className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCreate}
            className="h-7 w-7 p-0 text-muted-foreground/70 transition-all hover:text-foreground"
            title="New file (Ctrl+N)"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-0.5 p-2">
          {files.length === 0 && (
            <div className="px-3 py-10 text-center">
              <FileText className="mx-auto mb-3 h-5 w-5 text-muted-foreground/50" />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                No notes yet.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground/70">
                Press Ctrl+N to begin.
              </p>
            </div>
          )}
          {files.map((file) => {
            const isActive = activeFile === file.path
            // Visual derivation only: nest rows by folder depth in the path
            const depth = Math.min(
              (file.path.match(/\//g) || []).length,
              4
            )
            return (
              <div
                key={file.path}
                onClick={() => onSelect(file.path)}
                style={
                  depth > 0
                    ? { marginLeft: `calc(${depth} * 0.875rem)` }
                    : undefined
                }
                className={`group flex min-h-8 cursor-pointer items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${
                  isActive
                    ? "bg-accent text-accent-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
                    : "text-sidebar-foreground/85 hover:bg-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <FileText
                    strokeWidth={isActive ? 2 : 1.75}
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isActive
                        ? "text-sidebar-primary"
                        : "text-muted-foreground/60 group-hover:text-muted-foreground"
                    }`}
                  />
                  <span
                    className={`truncate leading-5 ${isActive ? "font-medium" : ""}`}
                  >
                    {file.path}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 shrink-0 rounded p-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(file.path)
                  }}
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground/70 transition-colors hover:text-destructive" />
                </Button>
              </div>
            )
          })}
        </div>
      </ScrollArea>
      <div className="shrink-0 border-t border-sidebar-border/70 bg-sidebar-accent/30 px-3 py-2.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span className="text-[11px]">
            Press{" "}
            <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px font-mono text-[10px] text-muted-foreground">
              Ctrl+K
            </kbd>{" "}
            to search files
          </span>
        </div>
      </div>
    </aside>
  )
}
