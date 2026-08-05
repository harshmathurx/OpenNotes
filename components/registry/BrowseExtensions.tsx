"use client"

/**
 * Browse tab for the Extensions modal.
 *
 * Lists the community registry index with client-side search over
 * name/description/tags. Loading shows skeleton cards; a failed fetch
 * with no fallback shows an error with a Retry button; a query with no
 * hits shows "No extensions match." Entries already installed (by id)
 * or of kind "core" render with a muted Installed state via RegistryCard.
 */

import { useMemo, useState } from "react"
import { RefreshCw, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useExtensions } from "@/hooks/useExtensions"
import { RegistryCard } from "./RegistryCard"
import { useRegistry } from "./useRegistry"

export function BrowseExtensions() {
  const { extensions } = useExtensions()
  const installedIds = useMemo(
    () => new Set(extensions.map((ext) => ext.manifest.id)),
    [extensions]
  )
  const { entries, loading, error, reload } = useRegistry(installedIds)
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(q) ||
        entry.description.toLowerCase().includes(q) ||
        (entry.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    )
  }, [entries, query])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search extensions…"
          aria-label="Search extensions"
          className="pl-8"
        />
      </div>

      <div
        className="max-h-80 space-y-3 overflow-y-auto pr-1"
        aria-label="Available extensions"
      >
        {loading ? (
          <>
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/5" />
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : error ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load the extension registry.
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">{error}</p>
            <button
              type="button"
              onClick={reload}
              aria-label="Retry loading the registry"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            {query.trim() ? "No extensions match." : "No extensions available."}
          </p>
        ) : (
          filtered.map((entry) => (
            <RegistryCard
              key={entry.id}
              entry={entry}
              installed={installedIds.has(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
