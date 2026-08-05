import { describe, expect, it } from "vitest"
import { GitEngine } from "@/core/git/engine"
import { GitError } from "@/core/git/errors"
import type { GitResult, GitRunner } from "@/core/git/types"

/**
 * Scripted mock runner. Each call shifts the next entry off the script.
 * - result: what the runner resolves with
 * - error: the runner rejects (simulates spawn failure / missing binary)
 * - assert: optional expectation on the invocation (args, cwd)
 */
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

const CLEAN_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +0 -0",
  "",
].join("\n")

describe("checkAvailable", () => {
  it("reports version when git exists", async () => {
    const { run } = scriptRunner([ok("git version 2.39.3 (Apple Git-146)\n")])
    const engine = new GitEngine(run)
    expect(await engine.checkAvailable()).toEqual({
      available: true,
      version: "2.39.3",
    })
  })

  it("reports unavailable when the binary is missing (runner rejects)", async () => {
    const { run } = scriptRunner([{ error: new Error("spawn git ENOENT") }])
    const engine = new GitEngine(run)
    expect(await engine.checkAvailable()).toEqual({
      available: false,
      version: null,
    })
  })
})

describe("checkIdentity", () => {
  it("reports configured identity", async () => {
    const { run } = scriptRunner([ok("Harsh Rajmathur\n"), ok("harsh@example.com\n")])
    const engine = new GitEngine(run)
    expect(await engine.checkIdentity("/repo")).toEqual({
      configured: true,
      name: "Harsh Rajmathur",
      email: "harsh@example.com",
    })
  })

  it("reports unconfigured when user.email is missing (git exits 1, no stderr)", async () => {
    const { run } = scriptRunner([ok("Harsh Rajmathur\n"), fail("")])
    const engine = new GitEngine(run)
    expect(await engine.checkIdentity("/repo")).toEqual({
      configured: false,
      name: "Harsh Rajmathur",
      email: null,
    })
  })
})

describe("isRepo", () => {
  it("true inside a work tree", async () => {
    const { run } = scriptRunner([ok("true\n")])
    const engine = new GitEngine(run)
    expect(await engine.isRepo("/repo")).toBe(true)
  })

  it("false outside a work tree (exit 128)", async () => {
    const { run } = scriptRunner([
      {
        result: {
          code: 128,
          stderr:
            "fatal: not a git repository (or any of the parent directories): .git",
        },
      },
    ])
    const engine = new GitEngine(run)
    expect(await engine.isRepo("/not-a-repo")).toBe(false)
  })
})

describe("init", () => {
  it("uses git init -b main on modern git", async () => {
    const { run, calls } = scriptRunner([ok("")])
    const engine = new GitEngine(run)
    await engine.init("/repo")
    expect(calls.map((c) => c.args)).toEqual([["init", "-b", "main"]])
  })

  it("falls back to init + branch -M main when -b is unsupported", async () => {
    const { run, calls } = scriptRunner([
      fail("error: unknown option `b'\nusage: git init [-q | --quiet] [--bare] ..."),
      ok("Initialized empty Git repository in /repo/.git/\n"),
      ok(""),
    ])
    const engine = new GitEngine(run)
    await engine.init("/repo")
    expect(calls.map((c) => c.args)).toEqual([
      ["init", "-b", "main"],
      ["init"],
      ["branch", "-M", "main"],
    ])
  })

  it("rethrows non-GitError runner failures", async () => {
    const { run } = scriptRunner([{ error: new Error("spawn git ENOENT") }])
    const engine = new GitEngine(run)
    await expect(engine.init("/repo")).rejects.toThrow("spawn git ENOENT")
  })
})

describe("status", () => {
  it("returns parsed status", async () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +1 -0",
      "1 .M N... 100644 100644 100644 9c4b2f1 9c4b2f1 notes/todo.md",
      "? scratch.md",
      "",
    ].join("\n")
    const { run } = scriptRunner([ok(out)])
    const engine = new GitEngine(run)
    const status = await engine.status("/repo")
    expect(status.branch).toBe("main")
    expect(status.ahead).toBe(1)
    expect(status.modified).toEqual(["notes/todo.md"])
    expect(status.untracked).toEqual(["scratch.md"])
    expect(status.clean).toBe(false)
  })

  it("maps 'not a git repository' to an init hint with stderr verbatim", async () => {
    const stderr =
      "fatal: not a git repository (or any of the parent directories): .git"
    const { run } = scriptRunner([{ result: { code: 128, stderr } }])
    const engine = new GitEngine(run)
    const error = await engine.status("/elsewhere").catch((e) => e)
    expect(error).toBeInstanceOf(GitError)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBe(
      "This folder is not a git repository. Initialize one first (git init)."
    )
  })
})

describe("branches", () => {
  it("returns current branch and all branches", async () => {
    const { run, calls } = scriptRunner([ok("main\n"), ok("main\nfeature/login\n")])
    const engine = new GitEngine(run)
    expect(await engine.branches("/repo")).toEqual({
      current: "main",
      all: ["main", "feature/login"],
    })
    expect(calls[0].args).toEqual(["branch", "--show-current"])
  })

  it("returns current: null on detached HEAD", async () => {
    const { run } = scriptRunner([ok("\n"), ok("main\n")])
    const engine = new GitEngine(run)
    expect(await engine.branches("/repo")).toEqual({
      current: null,
      all: ["main"],
    })
  })
})

describe("createBranch / checkout", () => {
  it("runs git branch <name>", async () => {
    const { run, calls } = scriptRunner([ok("")])
    const engine = new GitEngine(run)
    await engine.createBranch("/repo", "feature/x")
    expect(calls[0].args).toEqual(["branch", "feature/x"])
  })

  it("runs git checkout <name> and surfaces stderr on failure", async () => {
    const stderr =
      "error: pathspec 'nope' did not match any file(s) known to git"
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.checkout("/repo", "nope").catch((e) => e)
    expect(error).toBeInstanceOf(GitError)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBeNull()
  })
})

describe("remotes / addRemote", () => {
  it("parses git remote -v", async () => {
    const out =
      "origin\tgit@github.com:harsh/opennotes.git (fetch)\norigin\tgit@github.com:harsh/opennotes.git (push)\n"
    const { run } = scriptRunner([ok(out)])
    const engine = new GitEngine(run)
    expect(await engine.remotes("/repo")).toEqual([
      {
        name: "origin",
        fetchUrl: "git@github.com:harsh/opennotes.git",
        pushUrl: "git@github.com:harsh/opennotes.git",
      },
    ])
  })

  it("returns empty list when there are no remotes", async () => {
    const { run } = scriptRunner([ok("")])
    const engine = new GitEngine(run)
    expect(await engine.remotes("/repo")).toEqual([])
  })

  it("runs git remote add and surfaces 'already exists' verbatim", async () => {
    const { run, calls } = scriptRunner([fail("error: remote origin already exists.")])
    const engine = new GitEngine(run)
    const error = await engine
      .addRemote("/repo", "origin", "git@github.com:harsh/opennotes.git")
      .catch((e) => e)
    expect(calls[0].args).toEqual([
      "remote",
      "add",
      "origin",
      "git@github.com:harsh/opennotes.git",
    ])
    expect(error).toBeInstanceOf(GitError)
    expect(error.message).toBe("error: remote origin already exists.")
  })
})

describe("commitAll", () => {
  it("stages everything, commits, and returns the hash", async () => {
    const { run, calls } = scriptRunner([
      ok(""),
      ok("[main 9c4b2f1] Add notes\n 1 file changed, 3 insertions(+)\n"),
      ok("9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\n"),
    ])
    const engine = new GitEngine(run)
    const result = await engine.commitAll("/repo", "Add notes")
    expect(result).toEqual({
      hash: "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      nothingToCommit: false,
    })
    expect(calls.map((c) => c.args)).toEqual([
      ["add", "-A"],
      ["commit", "-m", "Add notes"],
      ["rev-parse", "HEAD"],
    ])
  })

  it("returns nothingToCommit instead of throwing when the tree is clean", async () => {
    const { run } = scriptRunner([
      ok(""),
      fail("nothing to commit, working tree clean\n"),
    ])
    const engine = new GitEngine(run)
    expect(await engine.commitAll("/repo", "No-op")).toEqual({
      hash: null,
      nothingToCommit: true,
    })
  })

  it("maps missing identity to the VS Code config hint, stderr verbatim", async () => {
    const stderr = [
      "Author identity unknown",
      "",
      "*** Please tell me who you are.",
      "",
      "Run",
      "",
      "  git config --global user.email \"you@example.com\"",
      "  git config --global user.name \"Your Name\"",
      "",
      "to set your account's default identity.",
      "fatal: unable to auto-detect email address (got 'harsh@macbook.(none)')",
    ].join("\n")
    const { run } = scriptRunner([ok(""), { result: { code: 128, stderr } }])
    const engine = new GitEngine(run)
    const error = await engine.commitAll("/repo", "Add notes").catch((e) => e)
    expect(error).toBeInstanceOf(GitError)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBe(
      'Make sure you configure your "user.name" and "user.email" in git. See https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup.'
    )
  })
})

describe("push", () => {
  it("pushes with -u remote branch when setUpstream is set", async () => {
    const { run, calls } = scriptRunner([
      ok("To github.com:harsh/opennotes.git\n * [new branch]      main -> main\n"),
    ])
    const engine = new GitEngine(run)
    await engine.push("/repo", { setUpstream: true, remote: "origin", branch: "main" })
    expect(calls[0].args).toEqual(["push", "-u", "origin", "main"])
  })

  it("defaults to origin without a branch", async () => {
    const { run, calls } = scriptRunner([ok("")])
    const engine = new GitEngine(run)
    await engine.push("/repo")
    expect(calls[0].args).toEqual(["push", "origin"])
  })

  it("maps non-fast-forward rejection to 'Pull first, then push.'", async () => {
    const stderr = [
      "To github.com:harsh/opennotes.git",
      " ! [rejected]        main -> main (fetch first)",
      "error: failed to push some refs to 'github.com:harsh/opennotes.git'",
      "hint: Updates were rejected because the remote contains work that you do",
      "hint: not have locally. This is usually caused by another repository pushing",
      "hint: to the same ref. You may want to first integrate the remote changes",
      "hint: (e.g., 'git pull ...') before pushing again.",
      "hint: See the 'Note about fast-forwards' in 'git push --help' for details.",
    ].join("\n")
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error).toBeInstanceOf(GitError)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBe("Pull first, then push.")
  })

  it("maps 'non-fast-forward' phrasing to the pull-first hint too", async () => {
    const stderr =
      " ! [rejected]        main -> main (non-fast-forward)\nerror: failed to push some refs to 'github.com:harsh/opennotes.git'"
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error.hint).toBe("Pull first, then push.")
  })

  it("maps missing upstream to the set-upstream hint", async () => {
    const stderr = [
      "fatal: The current branch main has no upstream branch.",
      "To push the current branch and set the remote as upstream, use",
      "",
      "    git push --set-upstream origin main",
    ].join("\n")
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBe(
      "The current branch has no upstream branch. Push with set-upstream to publish it."
    )
  })

  it("maps SSH publickey failure to the ssh-agent hint", async () => {
    const stderr = [
      "git@github.com: Permission denied (publickey).",
      "fatal: Could not read from remote repository.",
      "",
      "Please make sure you have the correct access rights",
      "and the repository exists.",
    ].join("\n")
    const { run } = scriptRunner([{ result: { code: 128, stderr } }])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error.message).toBe(stderr)
    expect(error.hint).toContain("ssh-agent")
    expect(error.hint).toContain(
      "https://docs.github.com/en/authentication/connecting-to-github-with-ssh"
    )
  })

  it("maps offline push (could not resolve host) to the offline hint", async () => {
    const stderr =
      "ssh: Could not resolve hostname github.com: nodename nor servname provided, or not known\nfatal: Could not read from remote repository."
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBe(
      "Could not reach the remote host. Check your internet connection and try again."
    )
  })

  it("leaves unknown failures verbatim with no hint", async () => {
    const stderr = "fatal: unexpected flush while reading remote side"
    const { run } = scriptRunner([fail(stderr)])
    const engine = new GitEngine(run)
    const error = await engine.push("/repo").catch((e) => e)
    expect(error.message).toBe(stderr)
    expect(error.hint).toBeNull()
  })
})

describe("pull", () => {
  it("reports changed: false when already up to date", async () => {
    const { run } = scriptRunner([ok("Already up to date.\n")])
    const engine = new GitEngine(run)
    expect(await engine.pull("/repo")).toEqual({ changed: false })
  })

  it("reports changed: true when files were updated", async () => {
    const stdout = [
      "From github.com:harsh/opennotes",
      "   1a2b3c4..9c4b2f1  main       -> origin/main",
      "Updating 1a2b3c4..9c4b2f1",
      "Fast-forward",
      " notes/todo.md | 2 ++",
      " 1 file changed, 2 insertions(+)",
    ].join("\n")
    const { run, calls } = scriptRunner([ok(stdout)])
    const engine = new GitEngine(run)
    expect(await engine.pull("/repo", { rebase: true })).toEqual({ changed: true })
    expect(calls[0].args).toEqual(["pull", "--rebase"])
  })
})

describe("log", () => {
  it("parses commits and passes the limit through", async () => {
    const out = [
      "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\x1f9c4b2f1\x1fAdd meeting notes\x1fHarsh Rajmathur\x1f2025-05-17T21:52:10+05:30",
      "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b\x1f1a2b3c4\x1fInitial commit\x1fHarsh Rajmathur\x1f2025-05-16T09:12:00+05:30",
    ].join("\n")
    const { run, calls } = scriptRunner([ok(out)])
    const engine = new GitEngine(run)
    const commits = await engine.log("/repo", 10)
    expect(commits).toHaveLength(2)
    expect(commits[0].shortHash).toBe("9c4b2f1")
    expect(calls[0].args).toEqual([
      "log",
      "--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%aI",
      "-n",
      "10",
    ])
  })

  it("defaults to limit 50", async () => {
    const { run, calls } = scriptRunner([ok("")])
    const engine = new GitEngine(run)
    expect(await engine.log("/repo")).toEqual([])
    expect(calls[0].args).toContain("50")
  })
})

describe("happy path: init → status clean → commit → status", () => {
  it("drives a full local lifecycle through the scripted runner", async () => {
    const dirty = [
      "# branch.oid (initial)",
      "# branch.head main",
      "? welcome.md",
      "",
    ].join("\n")
    const committed = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "",
    ].join("\n")

    const { run } = scriptRunner([
      ok(""), // init -b main
      ok(dirty), // status: untracked welcome.md
      ok(""), // add -A
      ok("[main (root-commit) 9c4b2f1] First note\n 1 file changed, 1 insertion(+)\n"),
      ok("9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\n"), // rev-parse HEAD
      ok(committed), // status: clean
    ])
    const engine = new GitEngine(run)

    await engine.init("/repo")

    const before = await engine.status("/repo")
    expect(before.branch).toBe("main")
    expect(before.untracked).toEqual(["welcome.md"])
    expect(before.clean).toBe(false)

    const commit = await engine.commitAll("/repo", "First note")
    expect(commit.nothingToCommit).toBe(false)
    expect(commit.hash).toBe("9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b")

    const after = await engine.status("/repo")
    expect(after.clean).toBe(true)
    expect(after.branch).toBe("main")
  })

  it("commitAll right after init with nothing staged is nothingToCommit, not an error", async () => {
    const { run } = scriptRunner([
      ok(""), // init -b main
      ok(""), // add -A
      fail("nothing to commit, working tree clean\n"),
    ])
    const engine = new GitEngine(run)
    await engine.init("/repo")
    expect(await engine.commitAll("/repo", "First note")).toEqual({
      hash: null,
      nothingToCommit: true,
    })
  })

  it("uses the canonical clean-status fixture without surprises", async () => {
    const { run } = scriptRunner([ok(CLEAN_STATUS)])
    const engine = new GitEngine(run)
    const status = await engine.status("/repo")
    expect(status).toEqual({
      branch: "main",
      upstream: "origin/main",
      ahead: 0,
      behind: 0,
      staged: [],
      modified: [],
      untracked: [],
      conflicted: [],
      clean: true,
    })
  })
})
