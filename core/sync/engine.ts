import type { StorageProvider } from "../storage/types"
import type { LocalFile } from "../db/schema"
import {
  enqueueSyncAction,
  getPendingSyncActions,
  markSyncAttempt,
  clearCompletedSync,
} from "./queue"
import { detectConflicts } from "./conflicts"

export type SyncStatus = "idle" | "syncing" | "unsynced" | "offline" | "error"

export interface SyncEngineOptions {
  provider: StorageProvider
  cadenceMs: number
  idleMs: number
  onStatusChange: (
    status: SyncStatus,
    details?: { unsyncedCount: number }
  ) => void
  onConflict: (
    path: string,
    localContent: string,
    remoteContent: string
  ) => void
}

export class SyncEngine {
  private provider: StorageProvider
  private cadenceMs: number
  private idleMs: number
  private onStatusChange: SyncEngineOptions["onStatusChange"]
  private onConflict: SyncEngineOptions["onConflict"]
  private timer: ReturnType<typeof setInterval> | null = null
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private isSyncing = false

  constructor(options: SyncEngineOptions) {
    this.provider = options.provider
    this.cadenceMs = options.cadenceMs
    this.idleMs = options.idleMs
    this.onStatusChange = options.onStatusChange
    this.onConflict = options.onConflict
  }

  start() {
    this.timer = setInterval(() => this.sync(), this.cadenceMs)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    if (this.idleTimer) clearTimeout(this.idleTimer)
  }

  async flush() {
    await this.sync()
  }

  private async sync() {
    if (this.isSyncing) return
    this.isSyncing = true
    this.onStatusChange("syncing")

    try {
      const pending = await getPendingSyncActions()

      for (const action of pending) {
        await markSyncAttempt(action.id!, "in-progress")

        try {
          if (action.action === "write" && action.content !== undefined) {
            await this.provider.writeFile(action.path, action.content)
          } else if (action.action === "delete") {
            await this.provider.deleteFile(action.path)
          }
          await markSyncAttempt(action.id!, "done")
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error"
          await markSyncAttempt(action.id!, "failed", errorMsg)
        }
      }

      await clearCompletedSync()

      const remaining = await getPendingSyncActions()
      if (remaining.length > 0) {
        this.onStatusChange("unsynced", { unsyncedCount: remaining.length })
      } else {
        this.onStatusChange("idle")
      }
    } catch {
      this.onStatusChange("error")
    } finally {
      this.isSyncing = false
    }
  }
}
