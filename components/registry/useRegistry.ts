"use client"

/**
 * Registry index loading for the Browse tab.
 *
 * Loads the community registry index via core/registry/fetch (which
 * already handles caching, timeouts, and the bundled offline fallback
 * from core/registry/builtin). The imports are feature-detected at call
 * time: the registry layer is being built in a parallel stream, so if
 * it isn't importable yet the hook falls back to a small local index
 * instead of crashing, and if every layer fails it surfaces an error.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import type { RegistryEntry } from "@/core/registry/types"

export type { RegistryEntry }

interface RegistryFetchModule {
  fetchRegistryIndex?: (options?: { cacheTtlMs?: number }) => Promise<{
    entries: RegistryEntry[]
  }>
}
interface RegistryBuiltinModule {
  BUILTIN_REGISTRY_INDEX?: { entries: RegistryEntry[] }
}

/** Dynamic imports wrapped in try/catch so a missing module degrades gracefully. */
async function importRegistryFetch(): Promise<RegistryFetchModule | null> {
  try {
    return (await import("@/core/registry/fetch")) as unknown as RegistryFetchModule
  } catch {
    return null
  }
}

async function importBuiltinIndex(): Promise<RegistryEntry[] | null> {
  try {
    const mod = (await import("@/core/registry/builtin")) as unknown as RegistryBuiltinModule
    return Array.isArray(mod.BUILTIN_REGISTRY_INDEX?.entries)
      ? mod.BUILTIN_REGISTRY_INDEX.entries
      : null
  } catch {
    return null
  }
}

/**
 * Last-resort local index mirroring the bundled core extensions, used
 * only when core/registry/* isn't importable yet. Keeps the Browse tab
 * honest (core entries render as installed) instead of crashing.
 */
const LOCAL_FALLBACK_ENTRIES: RegistryEntry[] = [
  {
    id: "git-sync",
    name: "Git Sync",
    version: "0.1.0",
    description: "Sync your notes folder with your local git.",
    author: "OpenNotes",
    repo: "https://github.com/opennotes/opennotes/tree/main/extensions/gitSync",
    tags: ["sync", "git"],
    kind: "core",
  },
  {
    id: "templates",
    name: "Templates",
    version: "0.1.0",
    description: "Insert rich note templates with date, time, and title variables.",
    author: "OpenNotes",
    repo: "https://github.com/opennotes/opennotes/tree/main/extensions/templates",
    tags: ["productivity", "writing"],
    kind: "core",
  },
  {
    id: "export",
    name: "Export",
    version: "0.1.0",
    description: "Export notes to Markdown, styled HTML, or a zip bundle.",
    author: "OpenNotes",
    repo: "https://github.com/opennotes/opennotes/tree/main/extensions/export",
    tags: ["export", "sharing"],
    kind: "core",
  },
  {
    id: "backlinks",
    name: "Backlinks",
    version: "0.1.0",
    description: "See which notes link here, and where this note links.",
    author: "OpenNotes",
    repo: "https://github.com/opennotes/opennotes/tree/main/extensions/backlinks",
    tags: ["links", "graph"],
    kind: "core",
  },
  {
    id: "ai-cowriter",
    name: "AI Co-Writer",
    version: "0.1.0",
    description: "An optional writing partner on your own API key or local model.",
    author: "OpenNotes",
    repo: "https://github.com/opennotes/opennotes/tree/main/extensions/aiCowriter",
    tags: ["ai", "writing"],
    kind: "core",
  },
]

export interface UseRegistryResult {
  /** Every entry in the registry index (core + community). */
  entries: RegistryEntry[]
  /** Community entries that are not currently installed. */
  available: RegistryEntry[]
  /** True while the index is loading (first load or reload). */
  loading: boolean
  /** Set only when the index could not be loaded from ANY source. */
  error: string | null
  /** Re-fetch the index, bypassing the fetch-layer cache. */
  reload: () => void
}

export function useRegistry(installedIds: ReadonlySet<string>): UseRegistryResult {
  const [entries, setEntries] = useState<RegistryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const fetchMod = await importRegistryFetch()
        if (!fetchMod || typeof fetchMod.fetchRegistryIndex !== "function") {
          throw new Error("Registry fetch layer is unavailable.")
        }
        // cacheTtlMs 0 on explicit reload bypasses the fetch-layer cache.
        const index = await fetchMod.fetchRegistryIndex(
          reloadToken > 0 ? { cacheTtlMs: 0 } : undefined
        )
        if (!cancelled) setEntries(index.entries)
      } catch (err) {
        // Defensive: fetch.ts already never throws, but if the module is
        // missing or its contract changed, fall back layer by layer.
        const builtin =
          (await importBuiltinIndex()) ?? LOCAL_FALLBACK_ENTRIES
        if (!cancelled) {
          if (builtin.length > 0) {
            setEntries(builtin)
          } else {
            setEntries([])
            setError(
              err instanceof Error ? err.message : "Failed to load the registry index."
            )
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [reloadToken])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])

  const available = useMemo(
    () => entries.filter((e) => e.kind === "community" && !installedIds.has(e.id)),
    [entries, installedIds]
  )

  return { entries, available, loading, error, reload }
}
