/**
 * Git Sync extension tests.
 *
 * Drives useGitSync with a fully scripted mock GitRunner (same pattern as
 * tests/git/engine.test.ts) — no real git is spawned. Covers the phase
 * machine (git missing → identity missing → not-a-repo → ready), the op
 * layer (commit/push/pull/add-remote/branch), and error mapping (stderr
 * verbatim into the inline region + toast, hint preserved).
 */

import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import type { GitResult, GitRunner, GitStatus } from "@/core/git/types"
import type { OpenNotesExtensionAPI } from "@/core/extensions/types"

import { useGitSync } from "@/extensions/gitSync/useGitSync"
import { GIT_SYNC_COPY as C } from "@/extensions/gitSync/copy"
import {
  createAutoSyncScheduler,
  deriveSyncState,
  relativeTime,
  type SyncStateInput,
} from "@/extensions/gitSync/syncState"
import { setNotesFolder, clearNotesFolder } from "@/core/vault/notesFolder"

/* ---------- Scripted mock runner (mirrors tests/git/engine.test.ts) ---------- */

type ScriptEntry = {
  result?: Partial<GitResult>
  error?: Error
  assert?: (args: string[], cwd: string) => void
}

function scriptRunner(script: ScriptEntry[]): {
  run: GitRunner
  calls: Array<{ args: string[]; cwd: string }>
} {
  const calls: Array<{ args: string[]; cwd: string }> = []
  const run: GitRunner = async (args, cwd) => {
    calls.push({ args: [...args], cwd })
    // The panel's refresh now fetches before reading status (so the banner can
    // learn about remote commits). That's a real behavior, but these scripted
    // tests predate it — answer `fetch` with a benign no-op so the scripts only
    // need to model the calls they actually assert on.
    if (args[0] === "fetch") {
      return { stdout: "", stderr: "", code: 0 }
    }
    const entry = script.shift()
    if (!entry) throw new Error(`unexpected git call: git ${args.join(" ")}`)
    entry.assert?.(args, cwd)
    if (entry.error) throw entry.error
    return { stdout: "", stderr: "", code: 0, ...entry.result }
  }
  return { run, calls }
}

const ok = (stdout = ""): ScriptEntry => ({ result: { stdout, code: 0 } })
const fail = (stderr: string, stdout = ""): ScriptEntry => ({
  result: { stderr, stdout, code: 1 },
})

/** Build a GitStatus fixture (the parser type; `upstream` ships in parallel). */
function makeStatus(overrides: Partial<GitStatus> = {}): GitStatus {
  return {
    branch: "main",
    upstream: "origin/main",
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    conflicted: [],
    clean: true,
    ...overrides,
  }
}

function makeSyncInput(overrides: Partial<SyncStateInput> = {}): SyncStateInput {
  return {
    status: makeStatus(),
    hasRemote: true,
    upstream: "origin/main",
    upstreamRemote: "origin",
    lastSyncAt: null,
    ...overrides,
  }
}

/* ---------- Status fixtures ---------- */

const CLEAN_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +0 -0",
  "",
].join("\n")

const DIRTY_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +2 -1",
  "1 M. N... 100644 100644 100644 9c4b2f1 9c4b2f1 notes/staged.md",
  "1 .M N... 100644 100644 100644 9c4b2f1 9c4b2f1 notes/todo.md",
  "? scratch.md",
  "",
].join("\n")

const REMOTES_OUT =
  "origin\tgit@github.com:harsh/notes.git (fetch)\norigin\tgit@github.com:harsh/notes.git (push)\n"

const LOG_OUT = [
  "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\x1f9c4b2f1\x1fAdd meeting notes\x1fHarsh\x1f2025-05-17T21:52:10+05:30",
  "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b\x1f1a2b3c4\x1fInitial commit\x1fHarsh\x1f2025-05-16T09:12:00+05:30",
].join("\n")

/**
 * Everything a ready-repo refresh needs, in the exact order the engine's
 * parallel Promise.all fires against the sequential mock runner:
 * status → branch --show-current → remote -v → log → branch --format.
 */
function readyProbes(status = CLEAN_STATUS, remotes = REMOTES_OUT, log = LOG_OUT): ScriptEntry[] {
  return [
    ok(status),
    ok("main\n"), // branch --show-current
    ok(remotes), // remote -v
    ok(log), // log -n 10
    ok("main\nfeature/x\n"), // branch --format=%(refname:short)
  ]
}

function bootEntries(status = CLEAN_STATUS): ScriptEntry[] {
  return [
    ok("git version 2.39.3 (Apple Git-146)\n"), // checkAvailable
    ok("Harsh Rajmathur\n"), // config user.name
    ok("harsh@example.com\n"), // config user.email
    ok("true\n"), // rev-parse --is-inside-work-tree
    ...readyProbes(status),
  ]
}

/* ---------- API stub ---------- */

function makeApi(): OpenNotesExtensionAPI & {
  toasts: string[]
  store: Map<string, string>
} {
  const toasts: string[] = []
  const store = new Map<string, string>([["repoPath", "/repo"]])
  return {
    toasts,
    store,
    getActiveNote: () => null,
    getNotes: () => [],
    openNote: () => {},
    insertIntoActiveNote: () => {},
    showToast: (m: string) => {
      toasts.push(m)
    },
    storage: {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => {
        store.set(k, v)
      },
    },
  }
}

const desktopOpts = { isDesktop: true, autoFocusRefresh: false }

async function renderSync(api: ReturnType<typeof makeApi>, run: GitRunner) {
  const view = renderHook(() =>
    useGitSync(api, { ...desktopOpts, runner: run })
  )
  await waitFor(() => {
    expect(view.result.current.phase).not.toBe("checking")
  })
  return view
}

beforeEach(() => {
  // useGitSync resolves the repo root from the unified notes folder, not the
  // old api.storage "repoPath" key. Seed the shared folder before each test.
  clearNotesFolder()
  setNotesFolder("/repo")
  // Make dynamic imports of the Tauri plugin unnecessary: pickFolder is never
  // called in these tests.
})

/* ---------- Phase machine ---------- */

describe("useGitSync phases", () => {
  it("stays in not-tauri outside the desktop app and never invokes git", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([])
    const { result } = renderHook(() =>
      useGitSync(api, { isDesktop: false, autoFocusRefresh: false, runner: run })
    )
    await waitFor(() => expect(result.current.phase).toBe("not-tauri"))
    expect(calls).toHaveLength(0)
  })

  it("lands in unavailable when the git binary is missing", async () => {
    const api = makeApi()
    const { run } = scriptRunner([{ error: new Error("spawn git ENOENT") }])
    const { result } = await renderSync(api, run)
    expect(result.current.phase).toBe("unavailable")
    expect(result.current.gitVersion).toBeNull()
  })

  it("lands in no-identity when user.email is unconfigured", async () => {
    const api = makeApi()
    const { run } = scriptRunner([
      ok("git version 2.39.3\n"),
      ok("Harsh Rajmathur\n"),
      fail(""), // git config user.email exits 1 when unset
    ])
    const { result } = await renderSync(api, run)
    expect(result.current.phase).toBe("no-identity")
  })

  it("lands in not-a-repo outside a work tree", async () => {
    const api = makeApi()
    const { run } = scriptRunner([
      ok("git version 2.39.3\n"),
      ok("Harsh Rajmathur\n"),
      ok("harsh@example.com\n"),
      {
        result: {
          code: 128,
          stderr: "fatal: not a git repository (or any of the parent directories): .git",
        },
      },
    ])
    const { result } = await renderSync(api, run)
    expect(result.current.phase).toBe("not-a-repo")
  })

  it("lands in no-folder when no notes folder path is stored", async () => {
    const api = makeApi()
    api.store.clear()
    // This case specifically needs NO notes folder set (override beforeEach).
    clearNotesFolder()
    const { run } = scriptRunner([ok("git version 2.39.3\n")])
    const { result } = await renderSync(api, run)
    expect(result.current.phase).toBe("no-folder")
  })

  it("boots a clean repo into ready with branch, remotes, and commits", async () => {
    const api = makeApi()
    const { run } = scriptRunner(bootEntries())
    const { result } = await renderSync(api, run)

    expect(result.current.phase).toBe("ready")
    expect(result.current.gitVersion).toBe("2.39.3")
    expect(result.current.status?.clean).toBe(true)
    expect(result.current.branches).toEqual({ current: "main", all: ["main", "feature/x"] })
    expect(result.current.remotes).toEqual([
      {
        name: "origin",
        fetchUrl: "git@github.com:harsh/notes.git",
        pushUrl: "git@github.com:harsh/notes.git",
      },
    ])
    expect(result.current.commits).toHaveLength(2)
    expect(result.current.commits[0].shortHash).toBe("9c4b2f1")
    expect(result.current.error).toBeNull()
  })

  it("boots a dirty repo and exposes staged/modified/untracked with ahead/behind", async () => {
    const api = makeApi()
    const { run } = scriptRunner(bootEntries(DIRTY_STATUS))
    const { result } = await renderSync(api, run)

    expect(result.current.phase).toBe("ready")
    const st = result.current.status
    expect(st?.staged).toEqual(["notes/staged.md"])
    expect(st?.modified).toEqual(["notes/todo.md"])
    expect(st?.untracked).toEqual(["scratch.md"])
    expect(st?.ahead).toBe(2)
    expect(st?.behind).toBe(1)
    expect(st?.clean).toBe(false)
  })
})

/* ---------- Init ---------- */

describe("initRepo", () => {
  it("initializes and flips the panel to ready", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ok("git version 2.39.3\n"),
      ok("Harsh Rajmathur\n"),
      ok("harsh@example.com\n"),
      { result: { code: 128, stderr: "fatal: not a git repository" } }, // isRepo: false
      ok(""), // init -b main
      ...readyProbes(), // refresh after op
    ])
    const { result } = await renderSync(api, run)
    expect(result.current.phase).toBe("not-a-repo")

    await act(async () => {
      await result.current.initRepo()
    })

    expect(calls.some((c) => c.args.join(" ") === "init -b main")).toBe(true)
    expect(result.current.phase).toBe("ready")
    expect(result.current.status?.clean).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("surfaces an init failure verbatim with its hint", async () => {
    const api = makeApi()
    const stderr = "fatal: cannot mkdir /repo: Permission denied"
    const { run } = scriptRunner([
      ok("git version 2.39.3\n"),
      ok("Harsh Rajmathur\n"),
      ok("harsh@example.com\n"),
      { result: { code: 128, stderr: "fatal: not a git repository" } },
      { result: { code: 128, stderr } }, // init -b main fails
      { result: { code: 128, stderr } }, // plain init fallback fails
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.initRepo()
    })

    expect(result.current.phase).toBe("not-a-repo")
    expect(result.current.error?.message).toBe(stderr)
    expect(api.toasts).toContain(stderr)
  })
})

/* ---------- Commit ---------- */

describe("commit", () => {
  it("commits all changes, toasts success, and refreshes to clean", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ...bootEntries(DIRTY_STATUS),
      ok(""), // add -A
      ok("[main 1b2c3d4] Ship it\n 2 files changed\n"),
      ok("1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c\n"), // rev-parse HEAD
      ...readyProbes(), // refresh after op
    ])
    const { result } = await renderSync(api, run)
    expect(result.current.status?.clean).toBe(false)

    let committed = false
    await act(async () => {
      committed = await result.current.commit("Ship it")
    })

    expect(committed).toBe(true)
    const commitCall = calls.find((c) => c.args[0] === "commit")
    expect(commitCall?.args).toEqual(["commit", "-m", "Ship it"])
    expect(api.toasts.some((t) => t.startsWith(C.commit.success))).toBe(true)
    expect(result.current.status?.clean).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("treats nothing-to-commit as a state, not an error", async () => {
    const api = makeApi()
    const { run } = scriptRunner([
      ...bootEntries(),
      ok(""), // add -A
      fail("nothing to commit, working tree clean\n"),
      ...readyProbes(), // refresh after op
    ])
    const { result } = await renderSync(api, run)

    let committed = true
    await act(async () => {
      committed = await result.current.commit("No-op")
    })

    expect(committed).toBe(false)
    expect(api.toasts).toContain(C.commit.nothingToCommit)
    expect(result.current.error).toBeNull()
  })

  it("rejects an empty message without touching git", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner(bootEntries())
    const { result } = await renderSync(api, run)
    const before = calls.length

    let committed = true
    await act(async () => {
      committed = await result.current.commit("   ")
    })

    expect(committed).toBe(false)
    expect(api.toasts).toContain(C.commit.emptyMessage)
    expect(calls.length).toBe(before)
  })

  it("maps a missing identity at commit time to the config hint, stderr verbatim", async () => {
    const api = makeApi()
    const stderr = [
      "Author identity unknown",
      "",
      "*** Please tell me who you are.",
      "",
      "fatal: unable to auto-detect email address (got 'harsh@macbook.(none)')",
    ].join("\n")
    const { run } = scriptRunner([
      ...bootEntries(DIRTY_STATUS),
      ok(""), // add -A
      { result: { code: 128, stderr } }, // commit fails
      ...readyProbes(DIRTY_STATUS), // refresh after op
    ])
    const { result } = await renderSync(api, run)

    let committed = true
    await act(async () => {
      committed = await result.current.commit("Ship it")
    })

    expect(committed).toBe(false)
    expect(result.current.error?.message).toBe(stderr)
    expect(result.current.error?.hint).toBe(
      'Make sure you configure your "user.name" and "user.email" in git. See https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup.'
    )
    expect(api.toasts).toContain(stderr)

    // And the inline region dismisses cleanly.
    act(() => result.current.dismissError())
    expect(result.current.error).toBeNull()
  })
})

/* ---------- Push / Pull ---------- */

describe("push", () => {
  it("pushes with -u origin <branch> and toasts", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ...bootEntries(),
      ok("To github.com:harsh/notes.git\n * [new branch] main -> main\n"),
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.push()
    })

    const pushCall = calls.find((c) => c.args[0] === "push")
    expect(pushCall?.args).toEqual(["push", "-u", "origin", "main"])
    expect(api.toasts).toContain(C.sync.pushSuccess)
    expect(result.current.error).toBeNull()
  })

  it("maps a non-fast-forward rejection to 'Pull first, then push.'", async () => {
    const api = makeApi()
    const stderr = [
      "To github.com:harsh/notes.git",
      " ! [rejected]        main -> main (fetch first)",
      "error: failed to push some refs to 'github.com:harsh/notes.git'",
    ].join("\n")
    const { run } = scriptRunner([
      ...bootEntries(),
      fail(stderr),
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.push()
    })

    expect(result.current.error?.message).toBe(stderr)
    expect(result.current.error?.hint).toBe("Pull first, then push.")
    expect(api.toasts).toContain(stderr)
    expect(api.toasts).not.toContain(C.sync.pushSuccess)
  })
})

describe("pull", () => {
  it("reports 'already up to date' on a no-op pull", async () => {
    const api = makeApi()
    const { run } = scriptRunner([
      ...bootEntries(),
      ok("Already up to date.\n"),
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.pull()
    })

    expect(api.toasts).toContain(C.sync.pullUpToDate)
    expect(result.current.error).toBeNull()
  })

  it("reports updated when the pull brings new commits", async () => {
    const api = makeApi()
    const stdout = [
      "From github.com:harsh/notes",
      "   1a2b3c4..9c4b2f1  main -> origin/main",
      "Updating 1a2b3c4..9c4b2f1",
      "Fast-forward",
      " notes/todo.md | 2 ++",
    ].join("\n")
    const { run, calls } = scriptRunner([
      ...bootEntries(),
      ok(stdout),
      ...readyProbes(DIRTY_STATUS),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.pull()
    })

    expect(calls.find((c) => c.args[0] === "pull")?.args).toEqual(["pull"])
    expect(api.toasts).toContain(C.sync.pullUpdated)
    // Refresh picked up the post-pull dirty state.
    expect(result.current.status?.modified).toEqual(["notes/todo.md"])
  })
})

/* ---------- Remotes ---------- */

describe("addRemote", () => {
  it("adds a remote and refreshes the remotes list", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ...bootEntries(CLEAN_STATUS),
      ok(""), // remote add
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    let added = false
    await act(async () => {
      added = await result.current.addRemote("origin", "git@github.com:harsh/notes.git")
    })

    expect(added).toBe(true)
    expect(calls.find((c) => c.args[0] === "remote" && c.args[1] === "add")?.args).toEqual([
      "remote",
      "add",
      "origin",
      "git@github.com:harsh/notes.git",
    ])
    expect(api.toasts).toContain(C.remote.added)
  })

  it("surfaces 'already exists' verbatim without a hint", async () => {
    const api = makeApi()
    const stderr = "error: remote origin already exists."
    const { run } = scriptRunner([
      ...bootEntries(),
      fail(stderr),
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    let added = true
    await act(async () => {
      added = await result.current.addRemote("origin", "git@github.com:harsh/notes.git")
    })

    expect(added).toBe(false)
    expect(result.current.error?.message).toBe(stderr)
    expect(result.current.error?.hint).toBeNull()
  })

  it("rejects blank input without invoking git", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner(bootEntries())
    const { result } = await renderSync(api, run)
    const before = calls.length

    let added = true
    await act(async () => {
      added = await result.current.addRemote("  ", "git@github.com:harsh/notes.git")
    })

    expect(added).toBe(false)
    expect(calls.length).toBe(before)
  })
})

/* ---------- Branches ---------- */

describe("branches", () => {
  it("creates and switches to a new branch", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ...bootEntries(),
      ok(""), // branch feature/y
      ok(""), // checkout feature/y
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    let created = false
    await act(async () => {
      created = await result.current.createBranch("feature/y")
    })

    expect(created).toBe(true)
    expect(calls.find((c) => c.args[0] === "branch" && c.args[1] === "feature/y")).toBeTruthy()
    expect(calls.find((c) => c.args[0] === "checkout")?.args).toEqual(["checkout", "feature/y"])
    expect(api.toasts).toContain(`${C.branch.created}: feature/y`)
  })

  it("switches branches via checkout", async () => {
    const api = makeApi()
    const { run, calls } = scriptRunner([
      ...bootEntries(),
      ok(""), // checkout feature/x
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.checkoutBranch("feature/x")
    })

    expect(calls.find((c) => c.args[0] === "checkout")?.args).toEqual(["checkout", "feature/x"])
    expect(api.toasts).toContain(`${C.branch.switched}: feature/x`)
  })

  it("surfaces a checkout failure verbatim", async () => {
    const api = makeApi()
    const stderr = "error: pathspec 'nope' did not match any file(s) known to git"
    const { run } = scriptRunner([
      ...bootEntries(),
      fail(stderr),
      ...readyProbes(),
    ])
    const { result } = await renderSync(api, run)

    await act(async () => {
      await result.current.checkoutBranch("nope")
    })

    expect(result.current.error?.message).toBe(stderr)
    expect(api.toasts).toContain(stderr)
  })
})

/* ---------- Refresh ---------- */

describe("refresh", () => {
  it("re-probes and picks up new status", async () => {
    const api = makeApi()
    const { run } = scriptRunner([
      ...bootEntries(),
      // Manual refresh: full probe again, now dirty.
      ok("git version 2.39.3\n"),
      ok("Harsh Rajmathur\n"),
      ok("harsh@example.com\n"),
      ok("true\n"),
      ...readyProbes(DIRTY_STATUS),
    ])
    const { result } = await renderSync(api, run)
    expect(result.current.status?.clean).toBe(true)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.status?.clean).toBe(false)
    expect(result.current.status?.modified).toEqual(["notes/todo.md"])
  })
})

/* ---------- deriveSyncState ---------- */

describe("deriveSyncState", () => {
  it("no-remote when there are no remotes", () => {
    const s = deriveSyncState(makeSyncInput({ hasRemote: false }))
    expect(s.kind).toBe("no-remote")
    expect(s.primary?.action).toBe("add-remote")
  })

  it("no-upstream when the branch tracks nothing", () => {
    const s = deriveSyncState(makeSyncInput({ upstream: null }))
    expect(s.kind).toBe("no-upstream")
    expect(s.primary?.action).toBe("set-upstream")
    expect(s.primary?.label).toContain("origin")
  })

  it("synced when clean with an upstream, naming the remote", () => {
    const s = deriveSyncState(makeSyncInput())
    expect(s.kind).toBe("synced")
    expect(s.primary).toBeNull()
    expect(s.headline).toContain("origin")
  })

  it("ahead surfaces N commits not on the remote + a Push action", () => {
    const s = deriveSyncState(
      makeSyncInput({ status: makeStatus({ ahead: 2 }) })
    )
    expect(s.kind).toBe("ahead")
    expect(s.headline).toContain("2")
    expect(s.primary?.action).toBe("push")
  })

  it("behind surfaces N new on the remote + a Pull action", () => {
    const s = deriveSyncState(
      makeSyncInput({ status: makeStatus({ behind: 3 }) })
    )
    expect(s.kind).toBe("behind")
    expect(s.primary?.action).toBe("pull")
  })

  it("diverged when both ahead and behind, with a sync action", () => {
    const s = deriveSyncState(
      makeSyncInput({ status: makeStatus({ ahead: 2, behind: 3 }) })
    )
    expect(s.kind).toBe("diverged")
    expect(s.primary?.action).toBe("sync")
  })
})

/* ---------- relativeTime ---------- */

describe("relativeTime", () => {
  const now = new Date("2026-08-05T12:00:00Z")
  it("handles null and unparseable", () => {
    expect(relativeTime(null, now)).toBe("")
    expect(relativeTime("not-a-date", now)).toBe("")
  })
  it("just now / minutes / hours / days", () => {
    expect(relativeTime("2026-08-05T11:59:30Z", now)).toBe("just now")
    expect(relativeTime("2026-08-05T11:58:00Z", now)).toBe("2m ago")
    expect(relativeTime("2026-08-05T09:00:00Z", now)).toBe("3h ago")
    expect(relativeTime("2026-08-03T12:00:00Z", now)).toBe("2d ago")
  })
})

/* ---------- createAutoSyncScheduler (locked auto-pull policy) ---------- */

describe("createAutoSyncScheduler", () => {
  function makeScheduler(overrides: {
    enabled?: boolean
    busy?: boolean
    conflict?: boolean
    hidden?: boolean
    ahead?: number
    behind?: number
  }) {
    const fns: Array<() => void> = []
    const pushed: string[] = []
    const notified: number[] = []
    const sched = createAutoSyncScheduler({
      enabled: () => overrides.enabled ?? true,
      intervalMinutes: () => 30,
      isBusy: () => overrides.busy ?? false,
      hasConflict: () => overrides.conflict ?? false,
      isHidden: () => overrides.hidden ?? false,
      getAheadBehind: () => ({
        ahead: overrides.ahead ?? 0,
        behind: overrides.behind ?? 0,
      }),
      onAutoPush: () => pushed.push("push"),
      onNotifyBehind: (n) => notified.push(n),
      setIntervalFn: (fn) => {
        fns.push(fn)
        return fns.length - 1
      },
      clearIntervalFn: () => {},
    })
    sched.start()
    return { fns, pushed, notified, sched }
  }

  it("pushes automatically when ahead", () => {
    const { fns, pushed } = makeScheduler({ ahead: 2 })
    fns[0]()
    expect(pushed).toEqual(["push"])
  })

  it("only notifies (never pulls) when behind", () => {
    const { fns, pushed, notified } = makeScheduler({ behind: 3 })
    fns[0]()
    expect(pushed).toEqual([])
    expect(notified).toEqual([3])
  })

  it("is inert when disabled", () => {
    const { fns, pushed, notified } = makeScheduler({ enabled: false, ahead: 1, behind: 1 })
    fns[0]()
    expect(pushed).toEqual([])
    expect(notified).toEqual([])
  })

  it("skips when busy / conflict / hidden", () => {
    for (const flag of ["busy", "conflict", "hidden"] as const) {
      const { fns, pushed, notified } = makeScheduler({ [flag]: true, ahead: 1, behind: 1 })
      fns[0]()
      expect(pushed).toEqual([])
      expect(notified).toEqual([])
    }
  })

  it("does nothing when clean", () => {
    const { fns, pushed, notified } = makeScheduler({ ahead: 0, behind: 0 })
    fns[0]()
    expect(pushed).toEqual([])
    expect(notified).toEqual([])
  })
})
