"use client"

import { Button } from "@/components/ui/button"
import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react"
import type { SyncStatus } from "@/core/sync/engine"

interface SyncStatusProps {
  status: SyncStatus
  count: number
  onSync: () => void
}

export function SyncStatusIndicator({
  status,
  count,
  onSync,
}: SyncStatusProps) {
  const config: Record<
    SyncStatus,
    { icon: typeof Cloud; label: string; color: string }
  > = {
    idle: { icon: Cloud, label: "Synced", color: "text-primary" },
    syncing: { icon: Loader2, label: "Syncing...", color: "text-blue-500" },
    unsynced: {
      icon: AlertCircle,
      label: `${count} unsaved`,
      color: "text-amber-500",
    },
    offline: {
      icon: CloudOff,
      label: "Offline",
      color: "text-muted-foreground",
    },
    error: { icon: AlertCircle, label: "Error", color: "text-destructive" },
  }

  const { icon: Icon, label, color } = config[status]
  const isSpinning = status === "syncing"

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSync}
      className="h-7 gap-1.5 text-xs"
    >
      <Icon
        className={`h-3.5 w-3.5 ${color} ${isSpinning ? "animate-spin" : ""}`}
      />
      <span className={color}>{label}</span>
    </Button>
  )
}
