"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PanelLeft, Maximize2 } from "lucide-react"

interface TitleBarProps {
  path: string | null
  onToggleSidebar: () => void
  onToggleZen: () => void
  onRename: (newPath: string) => void
  children?: React.ReactNode
}

export function TitleBar({
  path,
  onToggleSidebar,
  onToggleZen,
  onRename,
  children,
}: TitleBarProps) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(path ?? "")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditValue(path ?? "")
  }, [path])

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
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-foreground"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>

        {editing ? (
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
            onClick={() => setEditing(true)}
            title="Click to rename"
          >
            {path || "Untitled"}
          </span>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {children}
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
