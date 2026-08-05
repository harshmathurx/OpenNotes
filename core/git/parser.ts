/**
 * Pure parsers for git command output. No I/O, no runner — string in, data out.
 *
 * Supported formats:
 *  - `git status --porcelain=v2 --branch`  (headers + XY entries)
 *  - `git log --pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%aI -n <limit>`
 *  - `git remote -v`
 */

import type { GitCommit, GitRemote, GitStatus } from "./types"

const FIELD_SEP = "\x1f"

function emptyStatus(): GitStatus {
  return {
    branch: null,
    upstream: null,
    ahead: 0,
    behind: 0,
    staged: [],
    modified: [],
    untracked: [],
    conflicted: [],
    clean: true,
  }
}

/**
 * XY status codes that indicate a merge conflict, per `git status` docs.
 */
const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"])

/**
 * Parse a single path field. A path containing special characters is emitted
 * by git as a C-style quoted string ("a\"b" etc.). For renamed/copied entries
 * (type `2 `) the field is `<newPath>\t<origPath>` and we keep the new path.
 */
function parsePathField(field: string): string {
  const tab = field.indexOf("\t")
  const path = tab === -1 ? field : field.slice(0, tab)
  if (path.startsWith('"') && path.endsWith('"')) {
    try {
      return JSON.parse(path) as string
    } catch {
      return path.slice(1, -1)
    }
  }
  return path
}

/**
 * Parse `git status --porcelain=v2 --branch` output.
 *
 * Headers:
 *   # branch.oid <commit>|(initial)
 *   # branch.head <branch>|(detached)
 *   # branch.upstream <upstream>
 *   # branch.ab +<ahead> -<behind>
 *
 * Entries (XY = staged/unstaged status):
 *   1 <XY> ... <path>          ordinary changed entry
 *   2 <XY> ... <path>\t<orig>  renamed/copied entry
 *   u <XY> ... <path>          unmerged (conflicted) entry
 *   ? <path>                   untracked
 *   ! <path>                   ignored
 */
export function parsePorcelainV2(stdout: string): GitStatus {
  const status = emptyStatus()

  for (const line of stdout.split("\n")) {
    if (line === "") continue

    if (line.startsWith("# ")) {
      if (line.startsWith("# branch.head ")) {
        const head = line.slice("# branch.head ".length).trim()
        status.branch = head === "(detached)" ? null : head
      } else if (line.startsWith("# branch.upstream ")) {
        // Absent entirely when the branch has no upstream (stays null).
        status.upstream = line.slice("# branch.upstream ".length).trim()
      } else if (line.startsWith("# branch.ab ")) {
        const match = /^# branch\.ab \+(\d+) -(\d+)$/.exec(line.trim())
        if (match) {
          status.ahead = Number(match[1])
          status.behind = Number(match[2])
        }
      }
      continue
    }

    const kind = line[0]

    if (kind === "?") {
      status.untracked.push(line.slice(2))
      continue
    }

    if (kind === "!") continue // ignored files are not surfaced

    if (kind === "u") {
      // u <XY> <sub> <mN1> <mN2> <mN3> <mW> <h1> <h2> <h3> <path>
      // (quoted paths may contain spaces, hence join from the path index)
      const path = parsePathField(line.split(" ").slice(10).join(" "))
      status.conflicted.push(path)
      continue
    }

    if (kind === "1" || kind === "2") {
      // 1 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <path>
      // 2 <XY> <sub> <mH> <mI> <mW> <hH> <hI> <R100> <path>\t<origPath>
      const spaceIdx = line.indexOf(" ")
      if (spaceIdx === -1 || spaceIdx + 2 >= line.length) continue
      const xy = line.slice(spaceIdx + 1, spaceIdx + 3)
      // After dropping "<kind> ", path sits at field index 7 (type 1) or 8 (type 2)
      const pathField = line
        .slice(spaceIdx + 1)
        .split(" ")
        .slice(kind === "2" ? 8 : 7)
        .join(" ")
      const path = parsePathField(pathField)

      if (CONFLICT_CODES.has(xy)) {
        // A conflict reported via ordinary entries (unusual, but be safe).
        status.conflicted.push(path)
        continue
      }

      const x = xy[0]
      const y = xy[1]
      if (x !== "." && x !== "?") status.staged.push(path)
      if (y !== "." && y !== "?") status.modified.push(path)
      continue
    }
  }

  status.clean =
    status.staged.length === 0 &&
    status.modified.length === 0 &&
    status.untracked.length === 0 &&
    status.conflicted.length === 0

  return status
}

/**
 * Remote name for an upstream ref like "origin/v2" → "origin". Falls back to
 * "origin" when there is no upstream or it has no "<remote>/" prefix — the
 * sensible default matching git's own convention.
 */
export function upstreamRemoteName(upstream: string | null): string {
  if (upstream === null) return "origin"
  const slash = upstream.indexOf("/")
  if (slash === -1) return "origin"
  return upstream.slice(0, slash)
}

/**
 * Parse `git log --pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%aI` output.
 * Fields are separated by \x1f (unit separator), commits by newlines.
 */
export function parseLog(stdout: string): GitCommit[] {
  const commits: GitCommit[] = []
  for (const line of stdout.split("\n")) {
    if (line.trim() === "") continue
    const parts = line.split(FIELD_SEP)
    if (parts.length < 5) continue
    commits.push({
      hash: parts[0],
      shortHash: parts[1],
      subject: parts[2],
      author: parts[3],
      date: parts[4],
    })
  }
  return commits
}

/**
 * Parse `git remote -v` output:
 *   origin\tgit@github.com:user/repo.git (fetch)
 *   origin\tgit@github.com:user/repo.git (push)
 *
 * Remotes without an explicit pushurl repeat the fetch url for push. A remote
 * that only has a fetch line gets fetchUrl === pushUrl. A remote whose push
 * is disabled shows `... (push)` with no usable url only in exotic configs;
 * we simply record what git prints.
 */
export function parseRemotes(stdout: string): GitRemote[] {
  const byName = new Map<string, { fetchUrl: string | null; pushUrl: string | null }>()

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "") continue
    const match = /^(\S+)\t(\S+) \((fetch|push)\)$/.exec(trimmed)
    if (!match) continue
    const [, name, url, kind] = match
    let entry = byName.get(name)
    if (!entry) {
      entry = { fetchUrl: null, pushUrl: null }
      byName.set(name, entry)
    }
    if (kind === "fetch") entry.fetchUrl = url
    else entry.pushUrl = url
  }

  const remotes: GitRemote[] = []
  for (const [name, { fetchUrl, pushUrl }] of byName) {
    const fetch = fetchUrl ?? pushUrl ?? ""
    const push = pushUrl ?? fetchUrl ?? ""
    remotes.push({ name, fetchUrl: fetch, pushUrl: push })
  }
  return remotes
}

/**
 * Parse `git branch --format=%(refname:short)` output into a list of names.
 */
export function parseBranchList(stdout: string): string[] {
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
}
