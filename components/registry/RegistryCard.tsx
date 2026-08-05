"use client"

/**
 * One registry entry card for the Browse tab.
 *
 * Shows name, version, author, description, tag chips, and a kind badge
 * ("Core" muted / "Community" violet). The right-side action depends on
 * state:
 * - kind "core" or already installed → muted "Installed" check (not a button).
 * - community + not installed → "Install" button. In the desktop app it
 *   dispatches an `opennotes:install-extension` window event and toasts
 *   the result; in the browser the button is disabled with an honest
 *   tooltip. The actual disk install is a separate stream.
 */

import { useState } from "react"
import { toast } from "sonner"
import { Check, Download, Globe, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isTauri } from "@/core/bridge/runtime"
import { cn } from "@/lib/utils"
import type { RegistryEntry } from "./useRegistry"

/** Window event the desktop host listens for to perform the disk install. */
export const INSTALL_EXTENSION_EVENT = "opennotes:install-extension"

interface RegistryCardProps {
  entry: RegistryEntry
  installed: boolean
}

export function RegistryCard({ entry, installed }: RegistryCardProps) {
  const [installing, setInstalling] = useState(false)

  const isCore = entry.kind === "core"
  const showInstalledState = isCore || installed

  function handleInstall() {
    if (!isTauri() || installing) return

    setInstalling(true)
    window.dispatchEvent(
      new CustomEvent<RegistryEntry>(INSTALL_EXTENSION_EVENT, { detail: entry })
    )

    toast.info(`Installing ${entry.name}…`)
    // The disk install is owned by the host listener (separate stream);
    // this only confirms the request was queued.
    window.setTimeout(() => {
      toast.success(`${entry.name} queued for install`)
      setInstalling(false)
    }, 800)
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <Package className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium">{entry.name}</h3>
              <span className="text-xs text-muted-foreground">
                v{entry.version}
              </span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.7rem]",
                  isCore
                    ? "bg-muted text-muted-foreground"
                    : "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                )}
              >
                {isCore ? "Core" : "Community"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {entry.description}
            </p>
            <p className="mt-1 text-[0.7rem] text-muted-foreground/70">
              {entry.author}
            </p>
            {(entry.tags?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {entry.tags!.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md bg-muted px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {entry.homepage && (
              <a
                href={entry.homepage}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground"
              >
                <Globe className="h-3 w-3" />
                Homepage
              </a>
            )}
          </div>
        </div>

        {showInstalledState ? (
          <span
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
            aria-label={`${entry.name} is installed`}
          >
            <Check className="h-3.5 w-3.5" />
            Installed
          </span>
        ) : isTauri() ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstall}
            disabled={installing}
            aria-label={`Install ${entry.name}`}
          >
            <Download className="h-3.5 w-3.5" />
            {installing ? "Installing…" : "Install"}
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex shrink-0 cursor-not-allowed">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="pointer-events-none"
                      aria-label={`Install ${entry.name} (desktop app only)`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Install
                    </Button>
                  </span>
                }
              />
              <TooltipContent>Install in the OpenNotes Mac app</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </section>
  )
}
