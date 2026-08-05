"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  PanelLeft,
  Maximize2,
  Sun,
  Moon,
  Menu,
  Settings,
  Puzzle,
  Sparkles,
} from "lucide-react"
import { useTheme } from "next-themes"

interface TitleBarProps {
  path: string | null
  onToggleSidebar: () => void
  onToggleZen: () => void
  onRename: (newPath: string) => void
  onOpenSettings: () => void
  onOpenExtensions?: () => void
  onOpenAI?: () => void
  onToggleMobileSidebar?: () => void
  homeActive?: boolean
  children?: React.ReactNode
}

export function TitleBar({
  path,
  onToggleSidebar,
  onToggleZen,
  onRename,
  onOpenSettings,
  onOpenExtensions,
  onOpenAI,
  onToggleMobileSidebar,
  homeActive,
  children,
}: TitleBarProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const handleSubmit = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== path) {
      onRename(trimmed)
    }
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmit()
    } else if (e.key === "Escape") {
      setEditValue(path ?? "")
      setEditing(false)
    }
  }

  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-background px-3 transition-colors duration-300">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="hidden h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground md:flex"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        {onToggleMobileSidebar && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleMobileSidebar}
            className="flex h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground md:hidden"
            title="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        )}

        {homeActive ? (
          <span className="truncate text-sm text-muted-foreground">
            Workspace
          </span>
        ) : editing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={handleKeyDown}
            className="min-w-0 flex-1 border-none bg-transparent text-sm text-foreground outline-none"
          />
        ) : (
          <span
            className="cursor-pointer truncate text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => {
              setEditValue(path ?? "")
              setEditing(true)
            }}
            title="Click to rename"
          >
            {path || "Untitled"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {children}
        {onOpenAI && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenAI}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="AI Co-Writer settings"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        )}
        {onOpenExtensions && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenExtensions}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Extensions"
          >
            <Puzzle className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenSettings}
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="Settings"
        >
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Toggle theme (D)"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleZen}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Zen mode (Ctrl+Shift+Z)"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
