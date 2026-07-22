"use client"

import { Button } from "@/components/ui/button"
import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react"
import type { SyncStatus } from "@/core/sync/engine"

interface SyncStatusProps {
  status: SyncStatus
  count: number
  onSync: () => void
  localOnly?: boolean
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
    "saved-local": {
      icon: CloudOff,
      label: "Saved locally",
      className: "text-muted-foreground",
    },
    pending: {
      icon: AlertCircle,
      label: count > 0 ? `${count} pending sync` : "Pending sync",
      className: "text-amber-500",
    },
    "remote-synced": {
      icon: Cloud,
      label: "Remote synced",
      className: "text-emerald-600 dark:text-emerald-400",
    },
    syncing: {
      icon: Loader2,
      label: "Syncing...",
      className: "text-blue-500 animate-spin",
    },
    offline: {
      icon: CloudOff,
      label: "Offline",
      className: "text-muted-foreground",
    },
    failed: {
      icon: AlertCircle,
      label: count > 0 ? `${count} sync failed` : "Sync failed",
      className: "text-destructive",
    },
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
          status === "remote-synced"
            ? "text-emerald-600 dark:text-emerald-400"
            : status === "failed"
              ? "text-destructive"
              : ""
        }
      >
        {label}
      </span>
    </Button>
  )
}
