/**
 * User-facing strings for the Git Sync extension, kept in one place so the
 * panel, hook, and tests all speak the same language. Tone: calm, honest,
 * VS-Code-familiar — git's own stderr is always shown verbatim alongside.
 */

export const GIT_SYNC_COPY = {
  panelTitle: "Git Sync",

  notTauri: {
    title: "Git sync runs in the OpenNotes Mac app",
    body: "Git sync runs in the OpenNotes Mac app, where it can use your local git.",
    reassurance: "Your notes stay safe in this browser either way.",
  },

  gitMissing: {
    title: "We couldn't find git on this Mac.",
    body: "Git Sync uses the git binary already on your system — no tokens, no OAuth. Install it and reopen the panel.",
    hint: "Install the Xcode Command Line Tools by running: xcode-select --install",
    linkLabel: "git-scm.com",
    linkHref: "https://git-scm.com",
  },

  identityMissing: {
    title: "Git doesn't know who you are yet.",
    body: 'Make sure you configure your "user.name" and "user.email" in git. OpenNotes never sets these for you.',
    linkLabel: "First-Time Git Setup",
    linkHref: "https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup",
  },

  notARepo: {
    title: "This folder isn't a git repository yet.",
    body: "Initialize git here to start versioning your notes locally.",
    initButton: "Initialize repository",
    initHint: "After initializing, you can connect to GitHub by adding a remote.",
  },

  header: {
    sync: "Sync",
    refresh: "Refresh status",
    overflow: "More actions",
    branchSwitcher: "Switch branch",
  },

  changes: {
    title: "Changes",
    empty: "Working tree clean. Nothing to commit.",
    badgeModified: "M",
    badgeUntracked: "U",
    badgeStaged: "S",
    badgeConflicted: "!",
  },

  commit: {
    placeholder: "Commit message",
    button: "Commit",
    nothingToCommit: "Nothing to commit",
    success: "Committed",
    emptyMessage: "Write a commit message first",
  },

  sync: {
    push: "Push",
    pull: "Pull",
    pushSuccess: "Pushed",
    pullUpToDate: "Already up to date",
    pullUpdated: "Pulled new changes",
  },

  remote: {
    title: "Remotes",
    add: "Add remote",
    namePlaceholder: "origin",
    urlPlaceholder: "git@github.com:you/notes.git",
    empty: "No remotes yet. Add one to push to GitHub.",
    added: "Remote added",
  },

  /**
   * The "am I synced?" banner. Always names the REMOTE (e.g. "origin"),
   * never a hosting brand — the user's remote may point anywhere.
   */
  banner: {
    lastSyncPrefix: "Last synced",
    noRemote: {
      headline: "Not connected to a remote",
      detail: "Add a remote to sync your notes with another place.",
      primary: "Add remote",
    },
    noUpstream: {
      headline: (branch: string) => `${branch} isn't tracking a remote branch`,
      headlineDetached: "This branch isn't tracking a remote branch",
      detail: (remote: string) => `Publish it to ${remote} to start syncing.`,
      primary: (remote: string) => `Push to ${remote}`,
    },
    synced: {
      headline: (remote: string) => `Synced with ${remote}`,
    },
    ahead: {
      headline: (n: number, noun: string, remote: string) =>
        `${n} ${noun} not on ${remote} yet`,
      primary: "Push",
    },
    behind: {
      headline: (n: number, noun: string, remote: string) => `${n} new ${noun} on ${remote}`,
      primary: "Pull",
    },
    diverged: {
      headline: (ahead: number, aheadNoun: string, behind: number, behindNoun: string) =>
        `${ahead} ${aheadNoun} to push, ${behind} ${behindNoun} to pull`,
      detail: (remote: string) => `You and ${remote} have both moved on. Rebase, then push.`,
      primary: "Sync now (pull, then push)",
    },
  },

  /**
   * Opt-in auto-sync. Locked policy: pushes automatically when AHEAD, only
   * notifies when BEHIND — it never silently rewrites a file mid-edit.
   */
  autoSync: {
    label: "Auto-sync",
    intervalLabel: "Sync every",
    behind: (n: number) => `${n} new ${n === 1 ? "commit" : "commits"} on the remote — pull when you're ready`,
    conflictStop:
      "Sync stopped: the rebase left conflicts. Resolve them, then push when you're ready.",
  },

  branch: {
    title: "Branches",
    createPlaceholder: "New branch name",
    created: "Branch created",
    switched: "Switched branch",
  },

  log: {
    title: "Recent commits",
    empty: "No commits yet.",
  },

  commands: {
    openToast: "Open the Git Sync panel",
    unavailable: "Git Sync needs the OpenNotes Mac app",
    noRepo: "Initialize the repository from the Git Sync panel first",
  },
} as const

export type GitSyncCopy = typeof GIT_SYNC_COPY
