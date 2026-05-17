"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { SyncEngine } from "@/core/sync/engine"
import type { SyncStatus } from "@/core/sync/engine"
import { useStorage } from "./useStorage"

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle")
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const engineRef = useRef<SyncEngine | null>(null)
  const { activeProvider } = useStorage()

  useEffect(() => {
    if (!activeProvider) {
      setStatus("idle")
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

  const flush = useCallback(async () => {
    if (engineRef.current) await engineRef.current.flush()
  }, [])

  return { status, unsyncedCount, flush }
}
