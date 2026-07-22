import type { StorageProvider } from "../storage/types"
import { db } from "../db/schema"
import {
  getPendingSyncActions,
  markSyncAttempt,
  clearCompletedSync,
} from "./queue"
import { detectConflicts } from "./conflicts"

export type SyncStatus =
  | "saved-local"
  | "pending"
  | "syncing"
  | "remote-synced"
  | "offline"
  | "failed"

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
      const localFiles = await db.files.toArray()
      const conflicts = await detectConflicts(this.provider, localFiles)
      if (conflicts.length > 0) {
        for (const conflict of conflicts) {
          this.onConflict(
            conflict.path,
            conflict.localContent,
            conflict.remoteContent
          )
          const matching = await db.syncQueue
            .where("path")
            .equals(conflict.path)
            .and((record) => record.status !== "done")
            .toArray()
          await Promise.all(
            matching.map((record) =>
              record.id
                ? markSyncAttempt(record.id, "failed", "Conflict detected").then(
                    () =>
                      markSyncAttempt(record.id!, "pending", "Conflict detected")
                  )
                : Promise.resolve()
            )
          )
        }
      }

      const pending = (await getPendingSyncActions()).filter(
        (action) => !conflicts.some((conflict) => conflict.path === action.path)
      )

      for (const action of pending) {
        await markSyncAttempt(action.id!, "in-progress")

        try {
          if (action.action === "write" && action.content !== undefined) {
            const written = await this.provider.writeFile(action.path, action.content)
            await db.files.update(action.path, {
              synced: true,
              syncPending: false,
              lastModified: written.lastModified,
            })
          } else if (action.action === "delete") {
            await this.provider.deleteFile(action.path)
          }
          await markSyncAttempt(action.id!, "done")
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : "Unknown error"
          await markSyncAttempt(action.id!, "failed", errorMsg)
          await markSyncAttempt(action.id!, "pending", errorMsg)
        }
      }

      await clearCompletedSync()

      const remaining = await getPendingSyncActions()
      if (remaining.length > 0) {
        const failed = remaining.some((action) => action.error)
        this.onStatusChange(failed ? "failed" : "pending", {
          unsyncedCount: remaining.length,
        })
      } else {
        this.onStatusChange("remote-synced", { unsyncedCount: 0 })
      }
    } catch {
      this.onStatusChange("offline")
    } finally {
      this.isSyncing = false
    }
  }
}
