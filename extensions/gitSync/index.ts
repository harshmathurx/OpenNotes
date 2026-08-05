/**
 * Git Sync extension — VS-Code-style source control for the notes folder.
 *
 * Syncs via the user's LOCAL git binary (no tokens, no OAuth): the user's
 * own git config (user.name/user.email) and SSH agent / credential helper
 * do auth. git's stderr is surfaced verbatim with friendly hints, exactly
 * like VS Code.
 *
 * The heavy lifting lives in useGitSync (state + ops) and GitSyncPanel (UI);
 * this file only wires the manifest, panel, and commands. Commands share one
 * GitEngine built on the bridge runner so palette actions behave identically
 * to panel actions.
 */

import { GitEngine } from "@/core/git/engine"
import { gitRunner } from "@/core/bridge/gitRunner"
import { isTauri } from "@/core/bridge/runtime"
import type { OpenNotesExtension, OpenNotesExtensionAPI } from "@/core/extensions/types"

import { GIT_SYNC_COPY as C } from "./copy"
import { GitSyncPanel } from "./GitSyncPanel"

const REPO_PATH_STORAGE_KEY = "repoPath"

/** One engine for all palette commands; stateless and cheap to construct. */
const engine = new GitEngine(gitRunner)

function repoPathOrToast(api: OpenNotesExtensionAPI): string | null {
  const path = api.storage.get(REPO_PATH_STORAGE_KEY)
  if (!path) api.showToast(C.commands.noRepo)
  return path
}

function guardDesktop(api: OpenNotesExtensionAPI): boolean {
  if (!isTauri()) {
    api.showToast(C.commands.unavailable)
    return false
  }
  return true
}

export const gitSyncExtension: OpenNotesExtension = {
  manifest: {
    id: "git-sync",
    name: "Git Sync",
    version: "0.1.0",
    description:
      "Sync your notes folder with your local git — VS Code-style, no tokens.",
    author: "OpenNotes",
    defaultEnabled: true,
  },

  activate(ctx) {
    ctx.registerPanel({
      id: "git-sync",
      title: C.panelTitle,
      icon: "FolderGit2",
      side: "right",
      component: GitSyncPanel,
    })

    ctx.registerCommand({
      id: "open",
      title: "Git Sync: Open panel",
      run(api) {
        // The host owns panel visibility; the command can only point the way.
        api.showToast(C.commands.openToast)
      },
    })

    ctx.registerCommand({
      id: "commit",
      title: "Git Sync: Commit all changes",
      async run(api) {
        if (!guardDesktop(api)) return
        const cwd = repoPathOrToast(api)
        if (!cwd) return

        const message =
          api.storage.get("lastCommitMessage")?.trim() ||
          window.prompt("Commit message")?.trim() ||
          ""
        if (!message) {
          api.showToast(C.commit.emptyMessage)
          return
        }

        try {
          const result = await engine.commitAll(cwd, message)
          if (result.nothingToCommit) {
            api.showToast(C.commit.nothingToCommit)
            return
          }
          api.storage.set("lastCommitMessage", message)
          api.showToast(C.commit.success)
        } catch (e) {
          api.showToast(e instanceof Error ? e.message : String(e))
        }
      },
    })

    ctx.registerCommand({
      id: "push",
      title: "Git Sync: Push",
      async run(api) {
        if (!guardDesktop(api)) return
        const cwd = repoPathOrToast(api)
        if (!cwd) return
        try {
          await engine.push(cwd, { setUpstream: true, remote: "origin" })
          api.showToast(C.sync.pushSuccess)
        } catch (e) {
          api.showToast(e instanceof Error ? e.message : String(e))
        }
      },
    })

    ctx.registerCommand({
      id: "pull",
      title: "Git Sync: Pull",
      async run(api) {
        if (!guardDesktop(api)) return
        const cwd = repoPathOrToast(api)
        if (!cwd) return
        try {
          const { changed } = await engine.pull(cwd)
          api.showToast(changed ? C.sync.pullUpdated : C.sync.pullUpToDate)
        } catch (e) {
          api.showToast(e instanceof Error ? e.message : String(e))
        }
      },
    })

    ctx.registerCommand({
      id: "refresh",
      title: "Git Sync: Refresh status",
      async run(api) {
        if (!guardDesktop(api)) return
        const cwd = repoPathOrToast(api)
        if (!cwd) return
        try {
          const status = await engine.status(cwd)
          api.showToast(
            status.clean
              ? C.changes.empty
              : `${C.changes.title}: ${status.staged.length + status.modified.length + status.untracked.length + status.conflicted.length}`
          )
        } catch (e) {
          api.showToast(e instanceof Error ? e.message : String(e))
        }
      },
    })
  },
}

export default gitSyncExtension
