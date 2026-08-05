/**
 * Shared types for the OpenNotes git engine.
 *
 * The engine drives the USER'S LOCAL GIT BINARY (like VS Code's built-in git):
 * no tokens, no OAuth — the user's own git config (user.name/user.email) and
 * SSH agent / credential helper perform authentication. Command execution is
 * injected as a `GitRunner`, so this module is fully environment-agnostic and
 * testable with mocks. A real runner (e.g. Tauri) implements `GitRunner`.
 */

export interface GitResult {
  stdout: string
  stderr: string
  code: number
}

export type GitRunner = (args: string[], cwd: string) => Promise<GitResult>

export interface GitStatus {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  staged: string[]
  modified: string[]
  untracked: string[]
  conflicted: string[]
  clean: boolean
}

export interface GitRemote {
  name: string
  fetchUrl: string
  pushUrl: string
}

export interface GitCommit {
  hash: string
  shortHash: string
  subject: string
  author: string
  date: string
}
