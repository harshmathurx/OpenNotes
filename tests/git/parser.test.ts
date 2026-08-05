import { describe, expect, it } from "vitest"
import {
  parseBranchList,
  parseLog,
  parsePorcelainV2,
  parseRemotes,
  upstreamRemoteName,
} from "@/core/git/parser"

describe("parsePorcelainV2", () => {
  it("parses a clean repo on main with upstream in sync", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +0 -0",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
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

  it("parses ahead/behind counts", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head feature/login",
      "# branch.upstream origin/feature/login",
      "# branch.ab +3 -2",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.branch).toBe("feature/login")
    expect(status.ahead).toBe(3)
    expect(status.behind).toBe(2)
    expect(status.clean).toBe(true)
  })

  it("parses a repo with no upstream (no branch.upstream / branch.ab headers)", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.branch).toBe("main")
    expect(status.upstream).toBeNull()
    expect(status.ahead).toBe(0)
    expect(status.behind).toBe(0)
  })

  it("parses an unborn branch (fresh init, no commits yet)", () => {
    const out = ["# branch.oid (initial)", "# branch.head main", ""].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.branch).toBe("main")
    expect(status.ahead).toBe(0)
    expect(status.behind).toBe(0)
    expect(status.clean).toBe(true)
  })

  it("parses detached HEAD as branch: null", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head (detached)",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.branch).toBeNull()
    expect(status.upstream).toBeNull()
  })

  it("parses the upstream branch when present", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head v2",
      "# branch.upstream origin/v2",
      "# branch.ab +1 -0",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.branch).toBe("v2")
    expect(status.upstream).toBe("origin/v2")
  })

  it("parses an upstream on a custom remote", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "# branch.upstream upstream/main",
      "# branch.ab +0 -0",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.upstream).toBe("upstream/main")
  })

  it("parses staged, unstaged and untracked entries", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +0 -0",
      "1 M. N... 100644 100644 100644 9c4b2f1 9c4b2f1 notes/todo.md",
      "1 .M N... 100644 100644 100644 1a2b3c4 1a2b3c4 src/app.ts",
      "1 A. N... 000000 100644 100644 0000000 5d6e7f8 docs/new.md",
      "1 .D N... 100644 100644 000000 2b3c4d5 2b3c4d5 old/removed.md",
      "? ideas/brainstorm.md",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.staged).toEqual(["notes/todo.md", "docs/new.md"])
    expect(status.modified).toEqual(["src/app.ts", "old/removed.md"])
    expect(status.untracked).toEqual(["ideas/brainstorm.md"])
    expect(status.conflicted).toEqual([])
    expect(status.clean).toBe(false)
  })

  it("parses a file both staged and modified (XY = MM)", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "1 MM N... 100644 100644 100644 9c4b2f1 1a2b3c4 notes/todo.md",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.staged).toEqual(["notes/todo.md"])
    expect(status.modified).toEqual(["notes/todo.md"])
    expect(status.clean).toBe(false)
  })

  it("parses renamed entries (type 2) keeping the new path", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "2 R. N... 100644 100644 100644 9c4b2f1 9c4b2f1 R100 notes/renamed.md\tnotes/old-name.md",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.staged).toEqual(["notes/renamed.md"])
    expect(status.modified).toEqual([])
    expect(status.clean).toBe(false)
  })

  it("parses merge conflicts (u entries and XY conflict codes)", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "# branch.upstream origin/main",
      "# branch.ab +0 -1",
      "u UU N... 100644 100644 100644 100644 9c4b2f1 1a2b3c4 5d6e7f8 notes/clash.md",
      "u AA N... 100644 100644 100644 100644 9c4b2f1 1a2b3c4 5d6e7f8 both-added.md",
      "1 M. N... 100644 100644 100644 9c4b2f1 9c4b2f1 fine.md",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.conflicted).toEqual(["notes/clash.md", "both-added.md"])
    expect(status.staged).toEqual(["fine.md"])
    expect(status.clean).toBe(false)
  })

  it("parses quoted paths with special characters", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      '1 A. N... 000000 100644 100644 0000000 5d6e7f8 "notes/with \\"quotes\\".md"',
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.staged).toEqual(['notes/with "quotes".md'])
  })

  it("skips ignored (!) entries", () => {
    const out = [
      "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
      "# branch.head main",
      "! node_modules/",
      "! .DS_Store",
      "",
    ].join("\n")
    const status = parsePorcelainV2(out)
    expect(status.clean).toBe(true)
    expect(status.untracked).toEqual([])
  })

  it("handles completely empty output", () => {
    const status = parsePorcelainV2("")
    expect(status).toEqual({
      branch: null,
      upstream: null,
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

describe("upstreamRemoteName", () => {
  it("returns the remote name from a typical upstream", () => {
    expect(upstreamRemoteName("origin/v2")).toBe("origin")
  })

  it("returns a custom remote name", () => {
    expect(upstreamRemoteName("upstream/main")).toBe("upstream")
  })

  it("defaults to origin when upstream is null", () => {
    expect(upstreamRemoteName(null)).toBe("origin")
  })

  it("defaults to origin when upstream has no slash", () => {
    expect(upstreamRemoteName("v2")).toBe("origin")
  })
})

describe("parseLog", () => {
  it("parses commits separated by unit separators", () => {
    const out = [
      "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\x1f9c4b2f1\x1fAdd meeting notes\x1fHarsh Rajmathur\x1f2025-05-17T21:52:10+05:30",
      "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b\x1f1a2b3c4\x1fInitial commit\x1fHarsh Rajmathur\x1f2025-05-16T09:12:00+05:30",
    ].join("\n")
    const commits = parseLog(out)
    expect(commits).toEqual([
      {
        hash: "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
        shortHash: "9c4b2f1",
        subject: "Add meeting notes",
        author: "Harsh Rajmathur",
        date: "2025-05-17T21:52:10+05:30",
      },
      {
        hash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
        shortHash: "1a2b3c4",
        subject: "Initial commit",
        author: "Harsh Rajmathur",
        date: "2025-05-16T09:12:00+05:30",
      },
    ])
  })

  it("handles empty log (no commits)", () => {
    expect(parseLog("")).toEqual([])
  })

  it("handles a single commit without trailing newline", () => {
    const out =
      "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b\x1f1a2b3c4\x1fInitial commit\x1fHarsh\x1f2025-05-16T09:12:00+05:30"
    expect(parseLog(out)).toHaveLength(1)
  })
})

describe("parseRemotes", () => {
  it("parses fetch and push lines for one remote", () => {
    const out = [
      "origin\tgit@github.com:harsh/opennotes.git (fetch)",
      "origin\tgit@github.com:harsh/opennotes.git (push)",
      "",
    ].join("\n")
    expect(parseRemotes(out)).toEqual([
      {
        name: "origin",
        fetchUrl: "git@github.com:harsh/opennotes.git",
        pushUrl: "git@github.com:harsh/opennotes.git",
      },
    ])
  })

  it("parses multiple remotes", () => {
    const out = [
      "origin\tgit@github.com:harsh/opennotes.git (fetch)",
      "origin\tgit@github.com:harsh/opennotes.git (push)",
      "upstream\thttps://github.com/org/opennotes.git (fetch)",
      "upstream\thttps://github.com/org/opennotes.git (push)",
      "",
    ].join("\n")
    const remotes = parseRemotes(out)
    expect(remotes).toHaveLength(2)
    expect(remotes[0].name).toBe("origin")
    expect(remotes[1]).toEqual({
      name: "upstream",
      fetchUrl: "https://github.com/org/opennotes.git",
      pushUrl: "https://github.com/org/opennotes.git",
    })
  })

  it("falls back to fetch url when push url is missing", () => {
    const out = ["origin\tgit@github.com:harsh/opennotes.git (fetch)", ""].join("\n")
    expect(parseRemotes(out)).toEqual([
      {
        name: "origin",
        fetchUrl: "git@github.com:harsh/opennotes.git",
        pushUrl: "git@github.com:harsh/opennotes.git",
      },
    ])
  })

  it("parses a distinct pushurl", () => {
    const out = [
      "origin\thttps://github.com/harsh/opennotes.git (fetch)",
      "origin\tgit@github.com:harsh/opennotes.git (push)",
      "",
    ].join("\n")
    expect(parseRemotes(out)).toEqual([
      {
        name: "origin",
        fetchUrl: "https://github.com/harsh/opennotes.git",
        pushUrl: "git@github.com:harsh/opennotes.git",
      },
    ])
  })

  it("handles no remotes", () => {
    expect(parseRemotes("")).toEqual([])
  })
})

describe("parseBranchList", () => {
  it("parses branch names and trims whitespace", () => {
    const out = "main\nfeature/login\nfix/sync-race\n"
    expect(parseBranchList(out)).toEqual(["main", "feature/login", "fix/sync-race"])
  })

  it("handles no branches (unborn HEAD)", () => {
    expect(parseBranchList("")).toEqual([])
  })
})
