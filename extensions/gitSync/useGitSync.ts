"use client"

/**
 * useGitSync — all git state and operations behind one hook.
 *
 * Builds a GitEngine on the user's local git binary (via the bridge GitRunner,
 * which talks to Tauri's run_git in the Mac app). In a plain browser the
 * runner rejects, so the hook degrades to a calm "desktop only" state and
 * never fires a git call.
 *
 * Error philosophy (same as VS Code): a failed op surfaces git's stderr
 * verbatim via api.showToast AND an inline, dismissible error region with
 * the raw message + any hint the engine attached. The hook never throws.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { GitEngine } from "@/core/git/engine"
import { GitError } from "@/core/git/errors"
import { upstreamRemoteName } from "@/core/git/parser"
import type { GitCommit, GitRemote, GitRunner, GitStatus } from "@/core/git/types"
import { gitRunner } from "@/core/bridge/gitRunner"
import { isTauri } from "@/core/bridge/runtime"
import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { getNotesFolder, onNotesFolderChange, setNotesFolder } from "@/core/vault/notesFolder"
import { GIT_SYNC_COPY as C } from "./copy"
import { createAutoSyncScheduler, deriveSyncState, type SyncState } from "./syncState"

// The git repo root IS the notes folder: the path comes from the shared
// notes-folder source of truth (core/vault/notesFolder), not a git-sync-local
// key, so the folder the user picks for notes is the repo git watches.

export type GitSyncPhase =
  | "checking"
  | "not-tauri"
  | "unavailable"
  | "no-identity"
  | "not-a-repo"
  | "ready"
  | "no-folder"

export interface GitSyncError {
  message: string
  hint: string | null
}

export interface AutoSyncPrefs {
  enabled: boolean
  intervalMinutes: number
  setEnabled(enabled: boolean): void
  setIntervalMinutes(minutes: number): void
}

/** api.storage keys (values already namespaced per-extension by the host). */
const STORAGE_LAST_SYNC_AT = "lastSyncAt"
const STORAGE_AUTO_SYNC = "autoSync"
const DEFAULT_AUTO_SYNC = { enabled: false, intervalMinutes: 30 } as const

/**
 * git fetch spawns a subprocess + network — automatic refreshes (post-op,
 * window-focus, probe) are throttled to at most one fetch per repo per
 * window. A manual "Refresh status" always fetches (refreshForced).
 */
function defaultFetchThrottleMs(): number {
  return 30_000
}

function readAutoSyncPrefs(raw: string | null): { enabled: boolean; intervalMinutes: number } {
  if (!raw) return { ...DEFAULT_AUTO_SYNC }
  try {
    const parsed = JSON.parse(raw) as { enabled?: unknown; intervalMinutes?: unknown }
    return {
      enabled: parsed.enabled === true,
      intervalMinutes:
        typeof parsed.intervalMinutes === "number" && parsed.intervalMinutes > 0
          ? parsed.intervalMinutes
          : DEFAULT_AUTO_SYNC.intervalMinutes,
    }
  } catch {
    return { ...DEFAULT_AUTO_SYNC }
  }
}

export interface UseGitSyncOptions {
  /** Injectable for tests; defaults to the real bridge runner. */
  runner?: GitRunner
  /** Injectable for tests; defaults to the real Tauri detection. */
  isDesktop?: boolean
  /** Injectable for tests; defaults to window focus/visibility listeners. */
  autoFocusRefresh?: boolean
  /**
   * Minimum wall-clock gap between git fetch subprocesses (per repo). Ops
   * and focus events inside the window refresh local state without a fetch.
   * Default 30s; tests/e2e inject 0 (always fetch).
   */
  fetchThrottleMs?: number
}

export interface UseGitSyncResult {
  phase: GitSyncPhase
  /** Absolute path of the notes folder (the repo root), or null when unknown. */
  repoPath: string | null
  gitVersion: string | null
  status: GitStatus | null
  branches: { current: string | null; all: string[] }
  remotes: GitRemote[]
  commits: GitCommit[]
  /** Last op error; shown inline + toasted. Null when dismissed or after success. */
  error: GitSyncError | null
  /** True while any git op is in flight (disables buttons). */
  busy: boolean

  /** The "am I synced to <remote>?" story, derived from live status. */
  syncState: SyncState
  /** ISO timestamp of the last successful push/pull (persisted), or null. */
  lastSyncAt: string | null
  /** Opt-in auto-sync prefs (persisted; OFF by default, 30min interval). */
  autoSync: AutoSyncPrefs

  pickFolder(): Promise<void>
  refresh(): Promise<void>
  /** Manual "Refresh status": always fetches (bypasses the fetch throttle). */
  refreshForced(): Promise<void>
  dismissError(): void
  initRepo(): Promise<void>
  commit(message: string): Promise<boolean>
  push(): Promise<void>
  pull(): Promise<void>
  /** Guided diverged flow: pull --rebase, then push — stops on conflict. */
  syncNowGuided(): Promise<boolean>
  addRemote(name: string, url: string): Promise<boolean>
  checkoutBranch(name: string): Promise<void>
  createBranch(name: string): Promise<boolean>
}

function toError(e: unknown): GitSyncError {
  if (e instanceof GitError) return { message: e.message, hint: e.hint }
  if (e instanceof Error) return { message: e.message, hint: null }
  return { message: String(e), hint: null }
}

export function useGitSync(
  api: OpenNotesExtensionAPI,
  opts: UseGitSyncOptions = {}
): UseGitSyncResult {
  const isDesktop = opts.isDesktop ?? isTauri()
  const autoFocusRefresh = opts.autoFocusRefresh ?? true
  const fetchThrottleMs = opts.fetchThrottleMs ?? defaultFetchThrottleMs()

  const engine = useMemo(() => new GitEngine(opts.runner ?? gitRunner), [opts.runner])

  const [phase, setPhase] = useState<GitSyncPhase>(isDesktop ? "checking" : "not-tauri")
  const [repoPath, setRepoPath] = useState<string | null>(() => getNotesFolder())
  const [gitVersion, setGitVersion] = useState<string | null>(null)
  const [status, setStatus] = useState<GitStatus | null>(null)
  const [branches, setBranches] = useState<{ current: string | null; all: string[] }>({
    current: null,
    all: [],
  })
  const [remotes, setRemotes] = useState<GitRemote[]>([])
  const [commits, setCommits] = useState<GitCommit[]>([])
  const [error, setError] = useState<GitSyncError | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    api.storage.get(STORAGE_LAST_SYNC_AT)
  )
  const [autoSyncPrefs, setAutoSyncPrefs] = useState(() =>
    readAutoSyncPrefs(api.storage.get(STORAGE_AUTO_SYNC))
  )

  // Refs mirror the latest values for the auto-sync scheduler's callbacks,
  // which are created once and read through these.
  const statusRef = useRef<GitStatus | null>(null)
  const autoSyncEnabledRef = useRef(autoSyncPrefs.enabled)
  const autoSyncIntervalRef = useRef(autoSyncPrefs.intervalMinutes)

  // Serialize git ops — VS Code does the same (one git process per repo).
  const busyRef = useRef(false)
  // Ops requested while busy coalesce into one trailing refresh (the op
  // itself is dropped — runOp is user-initiated and the busy button state
  // already blocks the UI; this guards programmatic callers like auto-sync).
  const refreshQueuedRef = useRef(false)
  // Throttle git fetch: a flurry of ops / focus events must not each spawn a
  // subprocess + network call. Local reads (status/branches/remotes/log) are
  // cheap and stay un-throttled.
  const lastFetchRef = useRef<{ cwd: string | null; at: number }>({
    cwd: null,
    at: 0,
  })
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  /** Record a successful sync (push or pull) — persisted for the banner. */
  const markSynced = useCallback(() => {
    const iso = new Date().toISOString()
    api.storage.set(STORAGE_LAST_SYNC_AT, iso)
    if (mountedRef.current) setLastSyncAt(iso)
  }, [api])

  const fail = useCallback(
    (e: unknown) => {
      const err = toError(e)
      if (mountedRef.current) setError(err)
      api.showToast(err.message)
    },
    [api]
  )

  /** Pull every piece of repo state in one refresh. */
  const refreshStatus = useCallback(
    async (cwd: string, opts?: { force?: boolean }) => {
      // Fetch first so the banner can learn about remote commits ("N new on
      // origin") without merging or rewriting local files. Best-effort: a
      // missing remote/upstream/offline is not a refresh failure.
      //
      // Throttling: AUTOMATIC refreshes (post-op, window-focus, probe) are
      // throttled to one fetch per repo per fetchThrottleMs so a flurry
      // doesn't spawn a subprocess + network storm. A MANUAL "Refresh status"
      // click (opts.force) always fetches — the user explicitly asked, so the
      // banner must be true. Local reads below are cheap and always run.
      const lastFetch = lastFetchRef.current
      const fetchDue =
        opts?.force === true ||
        lastFetch.cwd !== cwd ||
        Date.now() - lastFetch.at >= fetchThrottleMs
      if (fetchDue) {
        lastFetchRef.current = { cwd, at: Date.now() }
        await engine.fetch(cwd).catch(() => {})
      }
      const [st, br, rm, lg] = await Promise.all([
        engine.status(cwd),
        engine.branches(cwd).catch(() => ({ current: null, all: [] })),
        engine.remotes(cwd).catch(() => [] as GitRemote[]),
        // A repo with zero commits has no log — that's a state, not an error.
        engine.log(cwd, 10).catch(() => [] as GitCommit[]),
      ])
      if (!mountedRef.current) return
      setStatus(st)
      setBranches(br)
      setRemotes(rm)
      setCommits(lg)
    },
    [engine, fetchThrottleMs]
  )

  /** Initial probe: available → identity → repo → status. Never throws. */
  const probe = useCallback(async () => {
    if (!isDesktop) {
      setPhase("not-tauri")
      return
    }
    setPhase("checking")

    const { available, version } = await engine.checkAvailable()
    if (!mountedRef.current) return
    if (!available) {
      setPhase("unavailable")
      return
    }
    setGitVersion(version)

    const cwd = getNotesFolder()
    if (!cwd) {
      setPhase("no-folder")
      return
    }
    setRepoPath(cwd)

    const identity = await engine.checkIdentity(cwd)
    if (!mountedRef.current) return
    if (!identity.configured) {
      setPhase("no-identity")
      return
    }

    const repo = await engine.isRepo(cwd)
    if (!mountedRef.current) return
    if (!repo) {
      setPhase("not-a-repo")
      return
    }

    try {
      await refreshStatus(cwd)
      if (mountedRef.current) setPhase("ready")
    } catch (e) {
      fail(e)
      if (mountedRef.current) setPhase("ready")
    }
  }, [engine, fail, isDesktop, refreshStatus])

  /** Force a fresh fetch + status (manual "Refresh status" — the user asked). */
  const refreshForced = useCallback(async () => {
    const cwd = repoPath ?? getNotesFolder()
    if (!cwd) return
    try {
      await refreshStatus(cwd, { force: true })
      if (mountedRef.current) setPhase((p) => (p === "checking" ? "ready" : p))
    } catch (e) {
      fail(e)
    }
  }, [repoPath, refreshStatus, fail])

  useEffect(() => {
    // Defer to a microtask so the probe's setState calls are async, not
    // synchronous within the effect body (react-hooks/set-state-in-effect).
    const id = setTimeout(() => void probe(), 0)
    // React when the notes folder changes elsewhere (vault/settings picker):
    // git's repo is the same folder, so re-probe against the new path.
    const unsubscribe = onNotesFolderChange(() => {
      setRepoPath(getNotesFolder())
      void probe()
    })
    return () => {
      clearTimeout(id)
      unsubscribe()
    }
    // Probe once on mount; folder changes arrive via the subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refresh = useCallback(async () => {
    if (!isDesktop) return
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      // A folder appearing / repo being initialized externally is picked up here.
      await probe()
    } finally {
      busyRef.current = false
      if (mountedRef.current) setBusy(false)
    }
  }, [probe, isDesktop])

  /** Re-probe when the panel regains focus (VS Code refreshes on focus too). */
  useEffect(() => {
    if (!autoFocusRefresh || !isDesktop) return
    const onFocus = () => void refresh()
    const onVisible = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        onFocus()
      }
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [autoFocusRefresh, isDesktop, refresh])

  /** Run one git op: guard busy, try/catch → toast + inline error, then refresh. */
  const runOp = useCallback(
    async <T,>(op: (cwd: string) => Promise<T>): Promise<T | null> => {
      const cwd = repoPath ?? getNotesFolder()
      if (!cwd) return null
      // If an op is already in flight, mark that another queued up: the
      // in-flight op's finally refreshes once at the end, covering both —
      // a flurry of ops never spawns a refresh storm.
      if (busyRef.current) {
        refreshQueuedRef.current = true
        return null
      }
      busyRef.current = true
      setBusy(true)
      setError(null)
      try {
        return await op(cwd)
      } catch (e) {
        fail(e)
        return null
      } finally {
        busyRef.current = false
        // A queued op collapsed into this one: its refresh flag is consumed
        // by the same single trailing refresh below.
        refreshQueuedRef.current = false
        try {
          await refreshStatus(cwd)
        } catch {
          // Status refresh after an op failing is not itself an error to surface.
        }
        if (mountedRef.current) setBusy(false)
      }
    },
    [fail, refreshStatus, repoPath]
  )

  const pickFolder = useCallback(async () => {
    if (!isDesktop) return
    // Lazy import keeps the Tauri plugin out of browser bundles.
    const { pickDirectory } = await import("@/core/bridge/dialog")
    const selected = await pickDirectory()
    if (!selected || !mountedRef.current) return
    // Route through the shared notes-folder source of truth so the vault and
    // git point at the SAME folder by construction.
    setNotesFolder(selected)
    setRepoPath(selected)
    await refresh()
  }, [isDesktop, refresh])

  const dismissError = useCallback(() => setError(null), [])

  const initRepo = useCallback(async () => {
    const ok = await runOp(async (cwd) => {
      await engine.init(cwd)
      return true
    })
    if (ok === true && mountedRef.current) setPhase("ready")
  }, [engine, runOp])

  const commit = useCallback(
    async (message: string): Promise<boolean> => {
      const trimmed = message.trim()
      if (!trimmed) {
        api.showToast(C.commit.emptyMessage)
        return false
      }
      const result = await runOp((cwd) => engine.commitAll(cwd, trimmed))
      if (result === null) return false
      if (result.nothingToCommit) {
        api.showToast(C.commit.nothingToCommit)
        return false
      }
      api.showToast(`${C.commit.success} ${result.hash ? `(${result.hash.slice(0, 7)})` : ""}`.trim())
      return true
    },
    [api, engine, runOp]
  )

  const push = useCallback(async () => {
    const branch = branches.current ?? status?.branch ?? undefined
    const result = await runOp((cwd) =>
      engine.push(cwd, { setUpstream: true, remote: "origin", branch })
    )
    if (result !== null) {
      markSynced()
      api.showToast(C.sync.pushSuccess)
    }
  }, [api, branches, engine, markSynced, runOp, status])

  const pull = useCallback(async () => {
    const result = await runOp((cwd) => engine.pull(cwd))
    if (result !== null) {
      markSynced()
      api.showToast(result.changed ? C.sync.pullUpdated : C.sync.pullUpToDate)
    }
  }, [api, engine, markSynced, runOp])

  const addRemote = useCallback(
    async (name: string, url: string): Promise<boolean> => {
      const n = name.trim()
      const u = url.trim()
      if (!n || !u) return false
      const result = await runOp((cwd) => engine.addRemote(cwd, n, u))
      if (result === null) return false
      api.showToast(C.remote.added)
      return true
    },
    [api, engine, runOp]
  )

  const checkoutBranch = useCallback(
    async (name: string) => {
      const result = await runOp((cwd) => engine.checkout(cwd, name))
      if (result !== null) api.showToast(`${C.branch.switched}: ${name}`)
    },
    [api, engine, runOp]
  )

  const createBranch = useCallback(
    async (name: string): Promise<boolean> => {
      const n = name.trim()
      if (!n) return false
      const result = await runOp(async (cwd) => {
        await engine.createBranch(cwd, n)
        await engine.checkout(cwd, n)
      })
      if (result === null) return false
      api.showToast(`${C.branch.created}: ${n}`)
      return true
    },
    [api, engine, runOp]
  )

  /**
   * Guided diverged flow: pull --rebase, then push. If the rebase hits a
   * conflict (or any git error), the error surfaces via the usual fail()
   * path and we STOP — never pushing a half-rebased state, never forcing.
   */
  const syncNowGuided = useCallback(async (): Promise<boolean> => {
    const branch = branches.current ?? status?.branch ?? undefined
    let rebased: { changed: boolean } | null = null
    const pulled = await runOp(async (cwd) => {
      rebased = await engine.pull(cwd, { rebase: true })
      return true
    })
    if (pulled === null || rebased === null) return false
    // runOp refreshed status after the rebase — a conflict stops the guided
    // flow here so the user resolves it by hand; we never push over it.
    if ((statusRef.current?.conflicted.length ?? 0) > 0) {
      fail(new Error(C.autoSync.conflictStop))
      return false
    }
    const pushed = await runOp((cwd) =>
      engine.push(cwd, { setUpstream: true, remote: "origin", branch })
    )
    if (pushed === null) return false
    markSynced()
    api.showToast(C.sync.pushSuccess)
    return true
  }, [api, branches, engine, fail, markSynced, runOp, status])

  /** The "am I synced to <remote>?" story the banner renders. */
  const syncState = useMemo<SyncState>(
    () =>
      deriveSyncState({
        status,
        hasRemote: remotes.length > 0,
        upstream: status?.upstream ?? null,
        upstreamRemote: upstreamRemoteName(status?.upstream ?? null),
        lastSyncAt,
      }),
    [status, remotes, lastSyncAt]
  )

  /** Opt-in auto-sync: setters persist the prefs and re-arm the scheduler. */
  const setAutoSyncEnabled = useCallback(
    (enabled: boolean) => {
      setAutoSyncPrefs((prev) => {
        const next = { ...prev, enabled }
        api.storage.set(STORAGE_AUTO_SYNC, JSON.stringify(next))
        return next
      })
    },
    [api]
  )
  const setAutoSyncIntervalMinutes = useCallback(
    (intervalMinutes: number) => {
      if (!(intervalMinutes > 0)) return
      setAutoSyncPrefs((prev) => {
        const next = { ...prev, intervalMinutes }
        api.storage.set(STORAGE_AUTO_SYNC, JSON.stringify(next))
        return next
      })
    },
    [api]
  )
  const autoSync = useMemo<AutoSyncPrefs>(
    () => ({
      enabled: autoSyncPrefs.enabled,
      intervalMinutes: autoSyncPrefs.intervalMinutes,
      setEnabled: setAutoSyncEnabled,
      setIntervalMinutes: setAutoSyncIntervalMinutes,
    }),
    [autoSyncPrefs, setAutoSyncEnabled, setAutoSyncIntervalMinutes]
  )

  // Keep the scheduler-readable refs current.
  useEffect(() => {
    statusRef.current = status
  }, [status])
  useEffect(() => {
    autoSyncEnabledRef.current = autoSyncPrefs.enabled
  }, [autoSyncPrefs.enabled])
  useEffect(() => {
    autoSyncIntervalRef.current = autoSyncPrefs.intervalMinutes
  }, [autoSyncPrefs.intervalMinutes])

  const schedulerRef = useRef<ReturnType<typeof createAutoSyncScheduler> | null>(null)

  /**
   * Auto-sync ticker. Created once, started only while the repo is ready
   * AND the user has opted in, stopped on unmount / when disabled. It
   * pushes when ahead, only notifies when behind — the busy guard
   * (busyRef) means it never fires during a scripted/manual op.
   */
  useEffect(() => {
    if (!schedulerRef.current) {
      schedulerRef.current = createAutoSyncScheduler({
        enabled: () => autoSyncEnabledRef.current,
        intervalMinutes: () => autoSyncIntervalRef.current,
        isBusy: () => busyRef.current,
        hasConflict: () => (statusRef.current?.conflicted.length ?? 0) > 0,
        isHidden: () =>
          typeof document !== "undefined" && document.visibilityState === "hidden",
        getAheadBehind: () => ({
          ahead: statusRef.current?.ahead ?? 0,
          behind: statusRef.current?.behind ?? 0,
        }),
        onAutoPush: () => void push(),
        onNotifyBehind: (n) => api.showToast(C.autoSync.behind(n)),
      })
    }
    const scheduler = schedulerRef.current
    if (phase === "ready" && autoSyncPrefs.enabled) {
      scheduler.start()
    } else {
      scheduler.stop()
    }
    return () => scheduler.stop()
  }, [api, phase, autoSyncPrefs.enabled, autoSyncPrefs.intervalMinutes, push])

  return {
    phase,
    repoPath,
    gitVersion,
    status,
    branches,
    remotes,
    commits,
    error,
    busy,
    syncState,
    lastSyncAt,
    autoSync,
    pickFolder,
    refresh,
    refreshForced,
    dismissError,
    initRepo,
    commit,
    push,
    pull,
    syncNowGuided,
    addRemote,
    checkoutBranch,
    createBranch,
  }
}
