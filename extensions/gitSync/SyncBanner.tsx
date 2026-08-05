"use client"

/**
 * SyncBanner — the persistent hero status line of the Git Sync panel.
 *
 * One calm line answering "what's synced to the remote, and what isn't?",
 * driven entirely by the hook's derived syncState (kind + headline/detail +
 * primary action). Below it, a slim auto-sync row (off by default, pushes
 * when ahead, only notifies when behind).
 *
 * The hook fields this component consumes (syncState, lastSyncAt, autoSync,
 * syncNowGuided) are added by the data layer; we type the prop loosely here
 * so this component stays presentational and decoupled from the hook's
 * exact return type.
 */

import * as React from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  CloudOff,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"

/* ---------- Loose hook typing (mirrors the data layer's contract) ---------- */

export type SyncStateKind =
  | "no-remote"
  | "no-upstream"
  | "synced"
  | "ahead"
  | "behind"
  | "diverged"

export interface SyncState {
  kind: SyncStateKind
  /** Remote display name (e.g. "origin") — copy always says "remote", never "GitHub". */
  remoteName: string | null
  /** Calm one-liner for the kind, e.g. "2 not on origin yet". */
  headline: string
  /** Optional muted follow-up line. */
  detail: string | null
  /** The single guided next step, when there is one. */
  primary: { action: "add-remote" | "set-upstream" | "push" | "pull" | "sync"; label: string } | null
}

/** The subset of the useGitSync return the banner needs. */
export interface SyncBannerGit {
  syncState?: SyncState
  lastSyncAt?: string | null
  busy: boolean
  status?: {
    branch: string | null
    upstream: string | null
    ahead: number
    behind: number
  } | null
  remotes?: Array<{ name: string }>
  autoSync?: {
    enabled: boolean
    intervalMinutes: number
    setEnabled(enabled: boolean): void
    setIntervalMinutes(minutes: number): void
  }
  push(): void | Promise<unknown>
  pull(): void | Promise<unknown>
  syncNowGuided?(): void | Promise<unknown>
}

export interface SyncBannerProps {
  git: SyncBannerGit
  /** Opens the panel's existing inline add-remote form. */
  onAddRemote?: () => void
}

/* ---------- Copy (banner-local until copy.ts lands its own strings) ---------- */

const BANNER_COPY = {
  noRemote: {
    headline: "Not connected to a remote",
    action: "Add remote",
  },
  noUpstream: (branch: string) => `${branch} isn't tracking a remote branch`,
  synced: (remote: string) => `Synced with ${remote}`,
  autoSync: {
    label: "Auto-sync",
    toggle: "Toggle auto-sync",
    interval: "Auto-sync interval",
    caption: (n: number) => `Auto-sync on · every ${n}m`,
  },
  diverged: {
    action: "Sync now (pull, then push)",
    hint: "Pulls with rebase, then pushes. Stops if there's a conflict.",
  },
  localOnly: "local",
} as const

const INTERVAL_OPTIONS = [5, 15, 30, 60] as const

/* ---------- Small helpers ---------- */

/** True when the auto-sync feature object is wired (i.e. busy is not a stale bool). */
function hasAutoSync(autoSync: SyncBannerGit["autoSync"] | undefined): boolean {
  return (
    !!autoSync &&
    typeof autoSync.setEnabled === "function" &&
    typeof autoSync.setIntervalMinutes === "function"
  )
}

/** Derive the sync state locally when the hook doesn't expose it yet (pre-merge). */
function deriveSyncState(git: SyncBannerGit): SyncState {
  if (git.syncState) return git.syncState
  const remoteName = git.remotes?.[0]?.name ?? null
  const branch = git.status?.branch ?? "main"
  const upstream = git.status?.upstream ?? null
  const ahead = git.status?.ahead ?? 0
  const behind = git.status?.behind ?? 0
  const remote = remoteName ?? "remote"

  if (!remoteName) {
    return {
      kind: "no-remote",
      remoteName: null,
      headline: BANNER_COPY.noRemote.headline,
      detail: null,
      primary: { action: "add-remote", label: BANNER_COPY.noRemote.action },
    }
  }
  if (!upstream) {
    return {
      kind: "no-upstream",
      remoteName,
      headline: BANNER_COPY.noUpstream(branch),
      detail: null,
      primary: { action: "set-upstream", label: `Push to ${remote}` },
    }
  }
  if (ahead > 0 && behind > 0) {
    return {
      kind: "diverged",
      remoteName,
      headline: `${ahead} to push, ${behind} to pull`,
      detail: null,
      primary: { action: "sync", label: BANNER_COPY.diverged.action },
    }
  }
  if (ahead > 0) {
    return {
      kind: "ahead",
      remoteName,
      headline: `${ahead} not on ${remote} yet`,
      detail: null,
      primary: { action: "push", label: "Push" },
    }
  }
  if (behind > 0) {
    return {
      kind: "behind",
      remoteName,
      headline: `${behind} new on ${remote}`,
      detail: null,
      primary: { action: "pull", label: "Pull" },
    }
  }
  return {
    kind: "synced",
    remoteName,
    headline: BANNER_COPY.synced(remote),
    detail: null,
    primary: null,
  }
}

/** "just now" / "2m ago" / "3h ago" — same shape as the panel's relativeDate. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

function InlineAction({
  onClick,
  disabled,
  label,
  primary = false,
}: {
  onClick: () => void
  disabled: boolean
  label: string
  primary?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium outline-none transition-colors",
        "focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/80"
          : "text-primary underline-offset-4 hover:underline"
      )}
    >
      {label}
    </button>
  )
}

/* ---------- Banner ---------- */

export function SyncBanner({ git, onAddRemote }: SyncBannerProps) {
  const syncState = deriveSyncState(git)
  const busy = git.busy
  const autoSync = git.autoSync
  const autoSyncWired = hasAutoSync(autoSync)
  const autoSyncEnabled = autoSync?.enabled ?? false
  const intervalMinutes = autoSync?.intervalMinutes ?? 30

  /** Guided diverged sync: the hook's syncNowGuided when present, else pull-then-push. */
  const runGuidedSync = () => {
    if (typeof git.syncNowGuided === "function") return void git.syncNowGuided()
    return void (async () => {
      await git.pull()
      await git.push()
    })()
  }

  const statusLine = (() => {
    switch (syncState.kind) {
      case "no-remote":
        return {
          icon: CloudOff,
          iconClass: "text-muted-foreground",
          headline: BANNER_COPY.noRemote.headline,
          action:
            syncState.primary?.label ?? BANNER_COPY.noRemote.action,
          onAction: () => onAddRemote?.(),
          primaryStyle: false,
        }
      case "no-upstream": {
        const branch = git.status?.branch ?? syncState.headline
        return {
          icon: ArrowUp,
          iconClass: "text-muted-foreground",
          headline: BANNER_COPY.noUpstream(branch),
          action: syncState.primary?.label ?? null,
          onAction: () => void git.push(),
          primaryStyle: true,
        }
      }
      case "synced": {
        const remote = syncState.remoteName ?? "remote"
        const since = git.lastSyncAt ? relativeTime(git.lastSyncAt) : ""
        return {
          icon: CheckCircle2,
          iconClass: "text-emerald-600 dark:text-emerald-400",
          headline: BANNER_COPY.synced(remote),
          action: null,
          onAction: null,
          primaryStyle: false,
          subline: since || null,
        }
      }
      case "ahead":
        return {
          icon: ArrowUp,
          iconClass: "text-muted-foreground",
          headline: syncState.headline,
          action: syncState.primary?.label ?? null,
          onAction: () => void git.push(),
          primaryStyle: true,
        }
      case "behind":
        return {
          icon: ArrowDown,
          iconClass: "text-muted-foreground",
          headline: syncState.headline,
          action: syncState.primary?.label ?? null,
          onAction: () => void git.pull(),
          primaryStyle: true,
        }
      case "diverged":
        return {
          icon: AlertTriangle,
          iconClass: "text-amber-600 dark:text-amber-400",
          headline: syncState.headline,
          action: syncState.primary?.label ?? BANNER_COPY.diverged.action,
          onAction: runGuidedSync,
          primaryStyle: true,
          subline: BANNER_COPY.diverged.hint,
        }
    }
  })()

  const Icon = statusLine.icon

  return (
    <section
      aria-label="Sync status"
      aria-busy={busy || undefined}
      className="space-y-1 rounded-lg border border-border/60 bg-background px-2.5 py-2"
    >
      {/* Status line */}
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", statusLine.iconClass)} />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground/90">
          {statusLine.headline}
        </p>
        {busy && (
          <RefreshCw
            className="h-3 w-3 shrink-0 animate-spin text-muted-foreground/60"
            aria-label="Syncing"
          />
        )}
        {statusLine.action && statusLine.onAction && (
          <InlineAction
            label={statusLine.action}
            disabled={busy}
            onClick={statusLine.onAction}
            primary={statusLine.primaryStyle}
          />
        )}
      </div>
      {statusLine.subline && (
        <p className="pl-[22px] text-[10px] leading-relaxed text-muted-foreground">
          {statusLine.subline}
        </p>
      )}

      {/* Auto-sync row */}
      <div className="flex items-center gap-1.5 border-t border-border/40 pt-1.5">
        <Clock className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        <span className="text-[11px] text-muted-foreground">
          {BANNER_COPY.autoSync.label}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={autoSyncEnabled}
          aria-label={BANNER_COPY.autoSync.toggle}
          disabled={busy || !autoSyncWired}
          onClick={() => autoSync?.setEnabled(!autoSyncEnabled)}
          className={cn(
            "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full outline-none transition-colors",
            "focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            autoSyncEnabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-3 w-3 transform rounded-full bg-background shadow-sm transition-transform",
              autoSyncEnabled ? "translate-x-3.5" : "translate-x-0.5"
            )}
          />
        </button>
        <select
          aria-label={BANNER_COPY.autoSync.interval}
          disabled={busy || !autoSyncEnabled || !autoSyncWired}
          value={intervalMinutes}
          onChange={(e) => autoSync?.setIntervalMinutes(Number(e.target.value))}
          className="rounded border border-border/80 bg-background px-1 py-0.5 text-[10px] text-muted-foreground outline-none disabled:opacity-50"
        >
          {INTERVAL_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}m
            </option>
          ))}
        </select>
        {autoSyncEnabled && (
          <span className="min-w-0 flex-1 truncate text-right text-[10px] text-muted-foreground/70">
            {BANNER_COPY.autoSync.caption(intervalMinutes)}
          </span>
        )}
      </div>
    </section>
  )
}

export default SyncBanner
