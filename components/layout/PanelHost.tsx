"use client"

/**
 * PanelHost — the dockable extension-panel region.
 *
 * Enabled extensions contribute panels (Git Sync, Backlinks, Export,
 * Templates, AI Co-Writer). This host renders a slim activity rail of
 * panel icons on the right edge and the active panel beside it. Clicking
 * a rail icon toggles that panel; the active panel id persists locally.
 *
 * Panel components receive the extension's live API instance via
 * useExtensions().getAPI(extensionId), so they can read notes, navigate,
 * insert into the editor, and toast.
 */

import * as React from "react"
import * as Icons from "lucide-react"
import type { ExtensionPanelEntry } from "@/hooks/useExtensions"
import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "opennotes-active-panel"

function resolveIcon(name?: string): React.ComponentType<{ className?: string }> {
  if (!name) return Icons.Puzzle
  const Icon = (Icons as Record<string, unknown>)[name]
  return (Icon as React.ComponentType<{ className?: string }>) ?? Icons.Puzzle
}

interface PanelHostProps {
  panels: ExtensionPanelEntry[]
  getAPI: (extensionId: string) => OpenNotesExtensionAPI
  /** Controlled active panel id (`${extensionId}:${panelId}`), or null for closed. */
  activePanelId: string | null
  onActivePanelChange: (id: string | null) => void
}

export function PanelHost({
  panels,
  getAPI,
  activePanelId,
  onActivePanelChange,
}: PanelHostProps) {
  const active = panels.find((p) => p.id === activePanelId) ?? null

  if (panels.length === 0) return null

  return (
    <div className="flex h-full shrink-0">
      {active && (
        <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-border/70 bg-background">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/90">
              {active.title}
            </span>
            <button
              onClick={() => onActivePanelChange(null)}
              aria-label="Close panel"
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-accent hover:text-foreground"
            >
              <Icons.X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <PanelBody panel={active} api={getAPI(active.extensionId)} />
          </div>
        </div>
      )}

      {/* Activity rail */}
      <div className="flex h-full w-11 shrink-0 flex-col items-center gap-1 border-l border-border/70 bg-muted/30 py-2">
        {panels.map((panel) => {
          const Icon = resolveIcon(panel.icon)
          const isActive = panel.id === activePanelId
          return (
            <button
              key={panel.id}
              onClick={() => onActivePanelChange(isActive ? null : panel.id)}
              title={panel.title}
              aria-label={panel.title}
              aria-pressed={isActive}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function PanelBody({
  panel,
  api,
}: {
  panel: ExtensionPanelEntry
  api: OpenNotesExtensionAPI
}) {
  const Component = panel.component as React.ComponentType<{
    api: OpenNotesExtensionAPI
  }>
  if (!Component) {
    return (
      <p className="p-4 text-sm text-muted-foreground">Panel unavailable.</p>
    )
  }
  return <Component api={api} />
}

/** Read the persisted active panel id (once, client-side). */
export function getPersistedActivePanel(): string | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

/** Persist the active panel id. */
export function persistActivePanel(id: string | null): void {
  try {
    if (typeof window === "undefined") return
    if (id) window.localStorage.setItem(STORAGE_KEY, id)
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // non-fatal
  }
}
