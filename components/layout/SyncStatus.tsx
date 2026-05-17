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
    { icon: typeof Cloud; label: string; className: string }
  > = {
    idle: {
      icon: Cloud,
      label: "Synced",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    syncing: {
      icon: Loader2,
      label: "Syncing...",
      className: "text-blue-500 animate-spin",
    },
    unsynced: {
      icon: AlertCircle,
      label: `${count} unsaved`,
      className: "text-amber-500",
    },
    offline: {
      icon: CloudOff,
      label: "Offline",
      className: "text-muted-foreground",
    },
    error: { icon: AlertCircle, label: "Error", className: "text-destructive" },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onSync}
      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Icon className={`h-3.5 w-3.5 ${className}`} />
      <span
        className={
          status === "idle"
            ? "text-emerald-600 dark:text-emerald-400"
            : status === "error"
              ? "text-destructive"
              : ""
        }
      >
        {label}
      </span>
    </Button>
  )
}
