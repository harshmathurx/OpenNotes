/**
 * fixtures.ts — temp-folder + temp-git-repo lifecycle for the e2e suite.
 *
 * Every test gets a FRESH temp directory on disk (os.tmpdir()/opennotes-e2e-*)
 * so tests are fully independent and safe to run in parallel. The mock
 * bridge (bridgeMock.ts) serves this folder to the app as "the notes
 * folder", and git helpers here run REAL `git` against it — so assertions
 * verify actual on-disk truth, not UI state alone.
 */

import { execFile } from "node:child_process"
import * as fs from "node:fs"
import * as fsp from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface TempWorkspace {
  /** Absolute path of the temp notes folder (== git repo root when initialized). */
  rootDir: string
  /** Remove the whole temp tree. Idempotent. */
  cleanup(): Promise<void>
}

/** Create a fresh empty notes folder. */
export async function createTempWorkspace(): Promise<TempWorkspace> {
  const rootDir = await fsp.mkdtemp(path.join(os.tmpdir(), "opennotes-e2e-"))
  return {
    rootDir,
    async cleanup() {
      await fsp.rm(rootDir, { recursive: true, force: true })
    },
  }
}

/* ------------------------------------------------------------------ */
/* Disk seeding + inspection (Node-side truth)                         */
/* ------------------------------------------------------------------ */

/** Write a note into the temp folder, creating parent folders. */
export async function seedNote(
  ws: TempWorkspace,
  relPath: string,
  content: string,
): Promise<void> {
  const abs = path.join(ws.rootDir, relPath)
  await fsp.mkdir(path.dirname(abs), { recursive: true })
  await fsp.writeFile(abs, content, "utf8")
}

/** Read a note from the temp folder (null when missing). */
export async function readNoteFromDisk(
  ws: TempWorkspace,
  relPath: string,
): Promise<string | null> {
  try {
    return await fsp.readFile(path.join(ws.rootDir, relPath), "utf8")
  } catch {
    return null
  }
}

/** Recursively list every .md file (relative paths, sorted). */
export async function listNotesOnDisk(ws: TempWorkspace): Promise<string[]> {
  const out: string[] = []
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: fs.Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === ".git") continue
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) await walk(path.join(dir, e.name), childRel)
      else if (e.isFile() && /\.md$/i.test(e.name)) out.push(childRel)
    }
  }
  await walk(ws.rootDir, "")
  return out.sort()
}

/* ------------------------------------------------------------------ */
/* Real git helpers                                                    */
/* ------------------------------------------------------------------ */

/** Run git in the workspace; returns stdout. Throws on non-zero exit. */
export async function git(
  ws: TempWorkspace,
  args: string[],
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd: ws.rootDir })
  return stdout
}

/** Run git tolerating failure (for existence checks). */
export async function gitOk(ws: TempWorkspace, args: string[]): Promise<boolean> {
  try {
    await execFileAsync("git", args, { cwd: ws.rootDir })
    return true
  } catch {
    return false
  }
}

/**
 * Initialize a real git repo with an initial branch of `main` and a local
 * user.name/user.email (so the repo is self-contained and commits never
 * depend on the developer's global git config).
 */
export async function initGitRepo(ws: TempWorkspace): Promise<void> {
  await git(ws, ["init", "-b", "main"])
  await git(ws, ["config", "user.name", "OpenNotes E2E"])
  await git(ws, ["config", "user.email", "e2e@opennotes.test"])
  // Self-contain hooks: never inherit the developer's global core.hooksPath
  // (org-wide pre-push allow-list guards would block this repo's pushes).
  // Passing the default `<gitdir>/hooks` explicitly wins over global config.
  await selfContainHooks(ws)
}

/** Commit everything currently in the folder (for seeded history). */
export async function gitCommitAll(
  ws: TempWorkspace,
  message: string,
): Promise<void> {
  await git(ws, ["add", "-A"])
  await git(ws, ["commit", "-m", message])
}

/** Number of commits on the current HEAD (0 when unborn — never throws). */
export async function gitCommitCount(ws: TempWorkspace): Promise<number> {
  const born = await gitOk(ws, ["rev-parse", "--verify", "HEAD"])
  if (!born) return 0
  const out = await git(ws, ["rev-list", "--count", "HEAD"])
  return Number(out.trim()) || 0
}

/** Subject lines of recent commits, newest first. */
export async function gitLogSubjects(ws: TempWorkspace): Promise<string[]> {
  const ok = await gitOk(ws, ["rev-parse", "--verify", "HEAD"])
  if (!ok) return []
  const out = await git(ws, ["log", "--pretty=%s"])
  return out.split("\n").filter((l) => l.length > 0)
}

/** Files touched by the latest commit. */
export async function gitShowLatestFiles(ws: TempWorkspace): Promise<string[]> {
  const out = await git(ws, ["show", "--pretty=", "--name-only", "HEAD"])
  return out.split("\n").filter((l) => l.trim().length > 0)
}

/** Content of `relPath` as committed at HEAD (null when absent). */
export async function gitShowFile(
  ws: TempWorkspace,
  relPath: string,
): Promise<string | null> {
  try {
    return await git(ws, ["show", `HEAD:${relPath}`])
  } catch {
    return null
  }
}

/** Current branch name. */
export async function gitCurrentBranch(ws: TempWorkspace): Promise<string> {
  return (await git(ws, ["branch", "--show-current"])).trim()
}

/* ------------------------------------------------------------------ */
/* Bare-remote helpers (prove local-vs-remote sync end to end)         */
/* ------------------------------------------------------------------ */

/**
 * Pin a repo to its OWN hooks directory so it never inherits the user's
 * global `core.hooksPath`. Some machines install org-wide pre-push guards
 * (security allow-lists) that block `git push`; an e2e repo must be
 * self-contained — exactly like initGitRepo self-contains user.name/email.
 * The default hooks dir is `<gitdir>/hooks`; passing it explicitly wins
 * over the global config while leaving the user's own setup untouched.
 */
async function selfContainHooks(ws: TempWorkspace): Promise<void> {
  const gitDir = (
    await git(ws, ["rev-parse", "--git-dir"])
  ).trim()
  const absHooks = path.isAbsolute(gitDir)
    ? path.join(gitDir, "hooks")
    : path.join(ws.rootDir, gitDir, "hooks")
  await git(ws, ["config", "core.hooksPath", absHooks])
}

/** Local identity so commits never depend on the developer's global config. */
async function setLocalIdentity(ws: TempWorkspace): Promise<void> {
  await git(ws, ["config", "user.name", "OpenNotes E2E"])
  await git(ws, ["config", "user.email", "e2e@opennotes.test"])
}

/**
 * Create a BARE repo in its own temp folder — the stand-in for "origin".
 * Reuses createTempWorkspace's lifecycle (mkdtemp + cleanup).
 */
export async function createBareRemote(): Promise<TempWorkspace> {
  const bare = await createTempWorkspace()
  await git(bare, ["init", "--bare", "--initial-branch=main"])
  await selfContainHooks(bare)
  return bare
}

/** Point the workspace's `origin` at the bare remote. */
export async function attachRemote(
  ws: TempWorkspace,
  bare: TempWorkspace,
): Promise<void> {
  await git(ws, ["remote", "add", "origin", bare.rootDir])
}

/** Push the branch to origin, establishing upstream tracking (-u). */
export async function pushToRemote(
  ws: TempWorkspace,
  branch = "main",
): Promise<void> {
  await git(ws, ["push", "-u", "origin", branch])
}

/**
 * Number of commits on `branch` in a (usually bare) repo. Returns 0 when the
 * branch doesn't exist yet — an unpushed branch is "0 on the remote", not an
 * error the test should trip over.
 */
export async function gitRemoteCommitCount(
  bare: TempWorkspace,
  branch = "main",
): Promise<number> {
  const ok = await gitOk(bare, ["rev-parse", "--verify", branch])
  if (!ok) return 0
  const out = await git(bare, ["rev-list", "--count", branch])
  return Number(out.trim()) || 0
}

/**
 * Subject lines of commits on `branch` in a (usually bare) repo, newest
 * first. Empty when the branch is absent.
 */
export async function gitRemoteLogSubjects(
  bare: TempWorkspace,
  branch = "main",
): Promise<string[]> {
  const ok = await gitOk(bare, ["rev-parse", "--verify", branch])
  if (!ok) return []
  const out = await git(bare, ["log", "--pretty=%s", branch])
  return out.split("\n").filter((l) => l.length > 0)
}

/**
 * Advance the remote WITHOUT the workspace knowing: clone the bare repo to a
 * THIRD temp dir, write+commit a file there, push it back to the bare remote,
 * then clean the clone up. The original `ws` is now behind (or diverged, if
 * it also committed locally in the meantime).
 *
 * The clone is self-contained too (own hooks + identity) so its push isn't
 * blocked by machine-level push guards either.
 */
export async function advanceRemote(
  ws: TempWorkspace,
  bare: TempWorkspace,
  opts: { fileName: string; content: string; message: string },
): Promise<void> {
  void ws // the workspace is deliberately untouched — that's the point
  const clone = await createTempWorkspace()
  try {
    await git(clone, ["clone", bare.rootDir, clone.rootDir])
    await selfContainHooks(clone)
    await setLocalIdentity(clone)
    const abs = path.join(clone.rootDir, opts.fileName)
    await fsp.mkdir(path.dirname(abs), { recursive: true })
    await fsp.writeFile(abs, opts.content, "utf8")
    await git(clone, ["add", "-A"])
    await git(clone, ["commit", "-m", opts.message])
    await git(clone, ["push", "origin", "main"])
  } finally {
    await clone.cleanup()
  }
}
