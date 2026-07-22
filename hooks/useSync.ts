"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { SyncEngine } from "@/core/sync/engine"
import type { SyncStatus } from "@/core/sync/engine"
import { db } from "@/core/db/schema"
import type { StorageProvider } from "@/core/storage/types"
import { isRemoteProviderActive } from "./useStorage"

export function useSync(activeProvider: StorageProvider) {
  const [status, setStatus] = useState<SyncStatus>("saved-local")
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const engineRef = useRef<SyncEngine | null>(null)

  useEffect(() => {
    if (!isRemoteProviderActive(activeProvider)) {
      queueMicrotask(() => {
        setStatus("saved-local")
        setUnsyncedCount(0)
      })
      return
    }

    const engine = new SyncEngine({
      provider: activeProvider,
      cadenceMs:
        activeProvider.id === "github" ? 30 * 60 * 1000 : 2 * 60 * 1000,
      idleMs: 60 * 1000,
      onStatusChange: (newStatus, details) => {
        setStatus(newStatus)
        setUnsyncedCount(details?.unsyncedCount ?? 0)
      },
      onConflict: (path, local, remote) => {
        window.dispatchEvent(
          new CustomEvent("sync-conflict", {
            detail: { path, local, remote },
          })
        )
      },
    })

    engine.start()
    engineRef.current = engine

    return () => engine.stop()
  }, [activeProvider])

  useEffect(() => {
    if (!isRemoteProviderActive(activeProvider)) return

    let cancelled = false
    const refreshPending = async () => {
      const count = await db.syncQueue
        .where("status")
        .anyOf(["pending", "failed"])
        .count()
      if (!cancelled && count > 0) {
        setStatus("pending")
        setUnsyncedCount(count)
      }
    }

    void refreshPending()
    return () => {
      cancelled = true
    }
  }, [activeProvider])

  const flush = useCallback(async () => {
    if (engineRef.current) await engineRef.current.flush()
  }, [])

  return { status, unsyncedCount, flush }
}
