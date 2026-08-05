"use client"

import { Button } from "@/components/ui/button"
import { CloudOff } from "lucide-react"

interface SyncStatusProps {
  onSync: () => void
}

/**
 * Calm save-state indicator for the Mac-app model: notes are real .md files
 * in the notes folder (or device storage) and save continuously. Clicking
 * forces any pending write to land now. No remote/PAT sync state exists.
 */
export function SyncStatusIndicator({ onSync }: SyncStatusProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSync}
      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <CloudOff className="h-3.5 w-3.5 text-muted-foreground" />
      <span>Saved on this device</span>
    </Button>
  )
}
