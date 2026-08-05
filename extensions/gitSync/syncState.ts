/**
 * syncState — pure, environment-free logic behind the Git Sync panel's
 * "am I synced to <remote>?" story and the opt-in auto-sync ticker.
 *
 * Everything here is a plain function: no React, no storage, no timers
 * beyond the ones injected — so it is fully unit-testable. The hook
 * (useGitSync.ts) wires this to live git state; the panel (owned by a
 * parallel agent) only renders the strings this module produces.
 *
 * Locked copy rules honored here:
 * - We say "remote" plus the remote's NAME (e.g. "Synced with origin"),
 *   never a hosting brand.
 * - Auto-sync pushes when AHEAD but only notifies when BEHIND — it never
 *   silently rewrites a file mid-edit (that decision lives in
 *   {@link createAutoSyncScheduler}).
 */

import type { GitStatus } from "@/core/git/types"
import { GIT_SYNC_COPY as C } from "./copy"

export type SyncStateKind =
  | "no-remote"
  | "no-upstream"
  | "synced"
  | "ahead"
  | "behind"
  | "diverged"

export interface SyncStateInput {
  status: GitStatus | null
  hasRemote: boolean
  upstream: string | null
  upstreamRemote: string
  lastSyncAt: string | null
}

export interface SyncState {
  kind: SyncStateKind
  remoteName: string
  headline: string
  detail: string
  primary: null | {
    action: "add-remote" | "set-upstream" | "push" | "pull" | "sync"
    label: string
  }
}

/** Last-resort name when a remote exists but the branch tracks none. */
const FALLBACK_REMOTE = "remote"

function commitWord(n: number): string {
  return n === 1 ? "commit" : "commits"
}

export function deriveSyncState(input: SyncStateInput): SyncState {
  const { status, hasRemote, upstream, upstreamRemote, lastSyncAt } = input

  // The remote we name in copy: the one the branch actually tracks; falling
  // back to the parsed upstream string, then to the generic word "remote"
  // (only reachable when a remote exists but nothing tracks it yet).
  const remoteName = upstreamRemote || (upstream ? upstream.split("/")[0] : "") || FALLBACK_REMOTE

  const lastSync =
    lastSyncAt !== null ? `${C.banner.lastSyncPrefix} ${relativeTime(lastSyncAt)}` : ""

  if (!hasRemote) {
    return {
      kind: "no-remote",
      remoteName,
      headline: C.banner.noRemote.headline,
      detail: C.banner.noRemote.detail,
      primary: { action: "add-remote", label: C.banner.noRemote.primary },
    }
  }

  if (!upstream) {
    const branch = status?.branch ?? ""
    const headline = branch
      ? C.banner.noUpstream.headline(branch)
      : C.banner.noUpstream.headlineDetached
    return {
      kind: "no-upstream",
      remoteName,
      headline,
      detail: C.banner.noUpstream.detail(remoteName),
      primary: { action: "set-upstream", label: C.banner.noUpstream.primary(remoteName) },
    }
  }

  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0

  if (ahead > 0 && behind > 0) {
    return {
      kind: "diverged",
      remoteName,
      headline: C.banner.diverged.headline(ahead, commitWord(ahead), behind, commitWord(behind)),
      detail: C.banner.diverged.detail(remoteName),
      primary: { action: "sync", label: C.banner.diverged.primary },
    }
  }

  if (ahead > 0) {
    return {
      kind: "ahead",
      remoteName,
      headline: C.banner.ahead.headline(ahead, commitWord(ahead), remoteName),
      detail: lastSync,
      primary: { action: "push", label: C.banner.ahead.primary },
    }
  }

  if (behind > 0) {
    return {
      kind: "behind",
      remoteName,
      headline: C.banner.behind.headline(behind, commitWord(behind), remoteName),
      detail: lastSync,
      primary: { action: "pull", label: C.banner.behind.primary },
    }
  }

  return {
    kind: "synced",
    remoteName,
    headline: C.banner.synced.headline(remoteName),
    detail: lastSync,
    primary: null,
  }
}

/**
 * Human relative time for an ISO timestamp: "just now" (<60s), "Nm ago"
 * (<60m), "Nh ago" (<24h), then "Nd ago". Null (or unparseable) → "".
 */
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (iso === null) return ""
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const seconds = Math.floor((now.getTime() - then) / 1000)
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/* ---------- Auto-sync scheduler ---------- */

export interface AutoSyncSchedulerOptions {
  enabled: () => boolean
  intervalMinutes: () => number
  isBusy: () => boolean
  hasConflict: () => boolean
  isHidden: () => boolean
  getAheadBehind: () => { ahead: number; behind: number }
  onAutoPush: () => void
  onNotifyBehind: (n: number) => void
  /** Injectable for fake-timer tests; defaults to the global setInterval. */
  setIntervalFn?: (fn: () => void, ms: number) => unknown
  /** Injectable for fake-timer tests; defaults to the global clearInterval. */
  clearIntervalFn?: (id: unknown) => void
}

export interface AutoSyncScheduler {
  /** (Re)arm the ticker with the current intervalMinutes. */
  start: () => void
  /** Clear the ticker and drop the visibility listener. */
  stop: () => void
}

const DEFAULT_INTERVAL_MINUTES = 30

/**
 * A setInterval ticker implementing the locked auto-pull policy:
 * each tick, when enabled && !busy && !hasConflict && !hidden, it reads
 * ahead/behind and
 *   - ahead > 0  → onAutoPush()        (pushing never rewrites local files)
 *   - behind > 0 → onNotifyBehind(n)   (pulling WOULD rewrite files mid-edit,
 *                                       so we only notify — never auto-pull)
 * Ticks are skipped while the document is hidden, and the timer is fully
 * inert until start() is called (auto-sync is OFF by default upstream).
 */
export function createAutoSyncScheduler(
  opts: AutoSyncSchedulerOptions
): AutoSyncScheduler {
  const setIv =
    opts.setIntervalFn ??
    ((fn: () => void, ms: number) => globalThis.setInterval(fn, ms))
  const clearIv =
    opts.clearIntervalFn ?? ((id: unknown) => globalThis.clearInterval(id as never))

  let timer: unknown = null
  let listening = false

  const tick = () => {
    if (!opts.enabled()) return
    if (opts.isBusy()) return
    if (opts.hasConflict()) return
    if (opts.isHidden()) return
    const { ahead, behind } = opts.getAheadBehind()
    if (ahead > 0) {
      opts.onAutoPush()
    } else if (behind > 0) {
      opts.onNotifyBehind(behind)
    }
  }

  const arm = () => {
    const minutes = opts.intervalMinutes()
    const ms = (minutes > 0 ? minutes : DEFAULT_INTERVAL_MINUTES) * 60_000
    timer = setIv(tick, ms)
  }

  // When the tab hides, drop the timer entirely so nothing fires in the
  // background; re-arm on return (double protection on top of the tick's
  // isHidden guard, which covers hidden-but-timer-alive moments).
  const onVisibility = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      if (timer !== null) {
        clearIv(timer)
        timer = null
      }
    } else if (timer === null && listening) {
      arm()
    }
  }

  const start = () => {
    if (timer !== null) clearIv(timer)
    arm()
    if (!listening && typeof document !== "undefined" && document.addEventListener) {
      document.addEventListener("visibilitychange", onVisibility)
      listening = true
    }
  }

  const stop = () => {
    if (timer !== null) {
      clearIv(timer)
      timer = null
    }
    if (listening && typeof document !== "undefined" && document.removeEventListener) {
      document.removeEventListener("visibilitychange", onVisibility)
      listening = false
    }
  }

  return { start, stop }
}
