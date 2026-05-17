"use client"

import { Button } from "@/components/ui/button"
import { PanelLeft, Maximize2 } from "lucide-react"

interface TitleBarProps {
  path: string | null
  onToggleSidebar: () => void
  onToggleZen: () => void
  children?: React.ReactNode
}

export function TitleBar({
  path,
  onToggleSidebar,
  onToggleZen,
  children,
}: TitleBarProps) {
  return (
    <div className="flex h-10 shrink-0 items-center justify-between border-b bg-background px-3 transition-colors duration-300">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Toggle sidebar"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span className="truncate text-sm text-muted-foreground">
          {path || "Untitled"}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleZen}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Zen mode"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
