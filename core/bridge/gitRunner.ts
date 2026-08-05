import { safeInvoke } from "./runtime"
import type { GitResult, GitRunner } from "@/core/git/types"

export type { GitResult, GitRunner }

/**
 * GitRunner backed by the user's local `git` binary via the Tauri shell.
 * No shell interpolation happens in Rust; auth is the user's git config +
 * SSH agent. In the browser this rejects via safeInvoke — the web app
 * should keep using its existing non-native git path there.
 */
export const gitRunner: GitRunner = (args, cwd) =>
  safeInvoke<GitResult>("run_git", { args, cwd })
