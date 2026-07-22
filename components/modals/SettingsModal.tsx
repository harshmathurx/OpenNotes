"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { BadgeCheck, Cloud, CloudOff, GitBranch, HardDrive } from "lucide-react"

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  providerName: string
  remoteEnabled: boolean
  remoteActive: boolean
  remoteError: string | null
  unsyncedCount: number
  onOpenGitHub: () => void
  onUseLocal: () => void
  onSyncNow: () => void
}

export function SettingsModal({
  open,
  onClose,
  providerName,
  remoteEnabled,
  remoteActive,
  remoteError,
  unsyncedCount,
  onOpenGitHub,
  onUseLocal,
  onSyncNow,
}: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Choose where notes are stored and check sync health.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Storage</h3>
                <p className="text-xs text-muted-foreground">
                  Current: {providerName}
                </p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                {remoteActive ? (
                  <Cloud className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <HardDrive className="h-3.5 w-3.5" />
                )}
                {remoteActive ? "GitHub sync on" : "Local browser"}
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant={remoteActive ? "outline" : "default"}
                className="h-auto justify-start gap-3 py-3"
                onClick={onUseLocal}
              >
                <HardDrive className="h-4 w-4" />
                <span className="text-left">
                  <span className="block text-sm">Use this browser</span>
                  <span className="block text-xs opacity-70">No account needed</span>
                </span>
              </Button>
              <Button
                variant={remoteActive ? "default" : "outline"}
                className="h-auto justify-start gap-3 py-3"
                onClick={onOpenGitHub}
                disabled={!remoteEnabled}
              >
                <GitBranch className="h-4 w-4" />
                <span className="text-left">
                  <span className="block text-sm">Sync to GitHub</span>
                  <span className="block text-xs opacity-70">One repo = one vault</span>
                </span>
              </Button>
            </div>

            {!remoteEnabled && (
              <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
                <CloudOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                GitHub sync is hidden in this build. Set
                NEXT_PUBLIC_ENABLE_REMOTE_STORAGE=true to enable it.
              </p>
            )}
            {remoteError && (
              <p className="mt-3 text-xs text-destructive">{remoteError}</p>
            )}
          </section>

          <section className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Sync health</h3>
                <p className="text-xs text-muted-foreground">
                  {unsyncedCount > 0
                    ? `${unsyncedCount} local change${unsyncedCount === 1 ? "" : "s"} waiting to sync.`
                    : "No pending local changes."}
                </p>
              </div>
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <Button variant="outline" size="sm" onClick={onSyncNow}>
              Sync now
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
