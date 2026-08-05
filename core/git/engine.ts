/**
 * Environment-agnostic git engine. Drives the user's local git binary through
 * an injected `GitRunner` — exactly how VS Code's built-in git works: no
 * tokens, no OAuth; the user's own git config + SSH agent / credential helper
 * do auth. stderr is surfaced verbatim on errors, with VS-Code-style hints
 * attached for well-known failure modes.
 */

import { GitError, gitErrorFromResult } from "./errors"
import { parseBranchList, parseLog, parsePorcelainV2, parseRemotes } from "./parser"
import type { GitCommit, GitRemote, GitResult, GitRunner, GitStatus } from "./types"

const LOG_FORMAT = "%H%x1f%h%x1f%s%x1f%an%x1f%aI"

export class GitEngine {
  private readonly run: GitRunner

  constructor(run: GitRunner) {
    this.run = run
  }

  /**
   * Run git and throw a GitError (stderr verbatim + hint) on non-zero exit.
   * Throws the original error if the runner itself rejects (binary missing,
   * spawn failure, ...).
   */
  private async exec(args: string[], cwd: string): Promise<GitResult> {
    const result = await this.run(args, cwd)
    if (result.code !== 0) throw gitErrorFromResult(result)
    return result
  }

  /** git --version → { available, version } */
  async checkAvailable(): Promise<{ available: boolean; version: string | null }> {
    try {
      const result = await this.run(["--version"], "/")
      if (result.code !== 0) return { available: false, version: null }
      // "git version 2.39.3 (Apple Git-146)"
      const match = /git version (\S+)/.exec(result.stdout)
      return { available: true, version: match ? match[1] : null }
    } catch {
      return { available: false, version: null }
    }
  }

  /** git config user.name / user.email (missing keys are not errors) */
  async checkIdentity(
    cwd: string
  ): Promise<{ configured: boolean; name: string | null; email: string | null }> {
    const nameResult = await this.run(["config", "user.name"], cwd)
    const emailResult = await this.run(["config", "user.email"], cwd)
    const name = nameResult.code === 0 ? nameResult.stdout.trim() || null : null
    const email = emailResult.code === 0 ? emailResult.stdout.trim() || null : null
    return { configured: name !== null && email !== null, name, email }
  }

  /** git rev-parse --is-inside-work-tree */
  async isRepo(cwd: string): Promise<boolean> {
    try {
      const result = await this.run(["rev-parse", "--is-inside-work-tree"], cwd)
      return result.code === 0 && result.stdout.trim() === "true"
    } catch {
      return false
    }
  }

  /** git init, preferring `git init -b main` (git ≥ 2.28) with fallback */
  async init(cwd: string): Promise<void> {
    try {
      await this.exec(["init", "-b", "main"], cwd)
      return
    } catch (error) {
      if (error instanceof GitError) {
        // Older git: no -b flag. Plain init, then rename the initial branch.
        await this.exec(["init"], cwd)
        await this.exec(["branch", "-M", "main"], cwd)
        return
      }
      throw error
    }
  }

  /** git status --porcelain=v2 --branch */
  async status(cwd: string): Promise<GitStatus> {
    const result = await this.exec(["status", "--porcelain=v2", "--branch"], cwd)
    return parsePorcelainV2(result.stdout)
  }

  /** Current branch (null when detached) + all local branch names */
  async branches(cwd: string): Promise<{ current: string | null; all: string[] }> {
    const currentResult = await this.run(["branch", "--show-current"], cwd)
    if (currentResult.code !== 0) throw gitErrorFromResult(currentResult)
    const listResult = await this.exec(["branch", "--format=%(refname:short)"], cwd)
    const current = currentResult.stdout.trim() || null
    return { current, all: parseBranchList(listResult.stdout) }
  }

  /** git branch <name> */
  async createBranch(cwd: string, name: string): Promise<void> {
    await this.exec(["branch", name], cwd)
  }

  /** git checkout <name> */
  async checkout(cwd: string, name: string): Promise<void> {
    await this.exec(["checkout", name], cwd)
  }

  /** git remote -v, parsed */
  async remotes(cwd: string): Promise<GitRemote[]> {
    const result = await this.exec(["remote", "-v"], cwd)
    return parseRemotes(result.stdout)
  }

  /** git remote add <name> <url> */
  async addRemote(cwd: string, name: string, url: string): Promise<void> {
    await this.exec(["remote", "add", name, url], cwd)
  }

  /**
   * git add -A && git commit. When there is nothing to commit, returns
   * { hash: null, nothingToCommit: true } instead of throwing — an empty
   * commit is a state, not an error (VS Code behaves the same way).
   */
  async commitAll(
    cwd: string,
    message: string
  ): Promise<{ hash: string | null; nothingToCommit: boolean }> {
    await this.exec(["add", "-A"], cwd)

    const commitResult = await this.run(["commit", "-m", message], cwd)
    if (commitResult.code !== 0) {
      if (isNothingToCommit(commitResult)) {
        return { hash: null, nothingToCommit: true }
      }
      throw gitErrorFromResult(commitResult)
    }

    // stdout: "[main abc1234] message" — but parse rev-parse for reliability.
    const hashResult = await this.run(["rev-parse", "HEAD"], cwd)
    const hash = hashResult.code === 0 ? hashResult.stdout.trim() || null : null
    return { hash, nothingToCommit: false }
  }

  /** git push, optionally -u <remote> <branch> */
  async push(
    cwd: string,
    opts?: { setUpstream?: boolean; remote?: string; branch?: string }
  ): Promise<void> {
    const args = ["push"]
    if (opts?.setUpstream) args.push("-u")
    const remote = opts?.remote ?? "origin"
    args.push(remote)
    if (opts?.branch) args.push(opts.branch)
    await this.exec(args, cwd)
  }

  /**
   * git fetch. Refreshes the local view of the remote WITHOUT touching the
   * working tree — this is what lets the banner learn about remote commits
   * ("N new on origin") without merging or rewriting local files. Never
   * throws on a missing remote/upstream (that's a valid "nothing to fetch"
   * state); surfaces genuine errors (offline, auth) as GitError.
   */
  async fetch(cwd: string): Promise<void> {
    const result = await this.exec(["fetch"], cwd)
    void result
  }

  /**
   * git pull (--rebase). `changed` is false when the pull was a no-op
   * ("Already up to date." / "Current branch ... is up to date.").
   */
  async pull(cwd: string, opts?: { rebase?: boolean }): Promise<{ changed: boolean }> {
    const args = ["pull"]
    if (opts?.rebase) args.push("--rebase")
    const result = await this.exec(args, cwd)
    const out = result.stdout.toLowerCase()
    const changed = !out.includes("already up to date") && !out.includes("is up to date")
    return { changed }
  }

  /** git log with unit-separator fields, most recent first */
  async log(cwd: string, limit = 50): Promise<GitCommit[]> {
    const result = await this.exec(
      ["log", `--pretty=format:${LOG_FORMAT}`, "-n", String(limit)],
      cwd
    )
    return parseLog(result.stdout)
  }
}

function isNothingToCommit(result: GitResult): boolean {
  const combined = `${result.stdout}\n${result.stderr}`.toLowerCase()
  return (
    combined.includes("nothing to commit") ||
    combined.includes("nothing added to commit") ||
    combined.includes("no changes added to commit")
  )
}
