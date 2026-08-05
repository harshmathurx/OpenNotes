/**
 * Registry index validation.
 *
 * `validateRegistryIndex` is a pure, dependency-free validator: strict on
 * shape (required fields, kinds, unique kebab-case ids) but tolerant in
 * behaviour — it never throws, never mutates input, and collects every
 * problem it finds so callers can surface them all at once.
 *
 * Rules:
 * - Document: `version` must be 1, `updatedAt` a parseable ISO string,
 *   `entries` an array.
 * - Every entry requires id/name/version/description/author/repo/kind.
 * - Ids must be kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`) and unique.
 * - kind "core": no `download` allowed (it ships bundled).
 * - kind "community": requires a `download` with a valid type and URL.
 * - URLs (repo, homepage, download.url) must be http(s) URLs.
 */

import type { RegistryEntry } from "./types"

export interface RegistryValidationResult {
  ok: boolean
  /** The validated index when ok; entries parsed so far when not. */
  entries: RegistryEntry[]
  /** Human-readable, path-anchored error messages (e.g. "entries[2].id: ..."). */
  errors: string[]
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/
const DOWNLOAD_TYPES = new Set(["github-release", "repo-dir"])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isHttpUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function validateEntry(raw: unknown, path: string, errors: string[]): RegistryEntry | null {
  if (!isRecord(raw)) {
    errors.push(`${path}: entry must be an object`)
    return null
  }

  let valid = true
  const fail = (field: string, message: string) => {
    errors.push(`${path}.${field}: ${message}`)
    valid = false
  }

  const { id, name, version, description, author, repo, homepage, tags, kind, download } = raw

  if (!isNonEmptyString(id)) fail("id", "required (non-empty string)")
  else if (!KEBAB_CASE.test(id)) fail("id", `must be kebab-case, got "${id}"`)

  if (!isNonEmptyString(name)) fail("name", "required (non-empty string)")
  if (!isNonEmptyString(version)) fail("version", "required (non-empty string)")
  if (!isNonEmptyString(description)) fail("description", "required (non-empty string)")
  if (!isNonEmptyString(author)) fail("author", "required (non-empty string)")
  if (!isHttpUrl(repo)) fail("repo", "required (http(s) URL)")

  if (homepage !== undefined && !isHttpUrl(homepage)) {
    fail("homepage", "must be an http(s) URL when present")
  }

  if (tags !== undefined) {
    if (!Array.isArray(tags) || tags.some((t) => !isNonEmptyString(t))) {
      fail("tags", "must be an array of non-empty strings when present")
    }
  }

  if (kind !== "core" && kind !== "community") {
    fail("kind", `must be "core" or "community", got ${JSON.stringify(kind)}`)
  }

  if (kind === "core" && download !== undefined) {
    fail("download", `must be absent for kind "core" (bundled with the app)`)
  }

  if (kind === "community") {
    if (!isRecord(download)) {
      fail("download", `required for kind "community"`)
    } else {
      if (!DOWNLOAD_TYPES.has(download.type as string)) {
        fail("download.type", `must be "github-release" or "repo-dir", got ${JSON.stringify(download.type)}`)
      }
      if (!isHttpUrl(download.url)) {
        fail("download.url", "required (http(s) URL)")
      }
    }
  } else if (download !== undefined && isRecord(download)) {
    // kind invalid but a download object was provided — still check it so
    // authors get the full picture in one pass.
    if (!DOWNLOAD_TYPES.has(download.type as string)) {
      fail("download.type", `must be "github-release" or "repo-dir", got ${JSON.stringify(download.type)}`)
    }
    if (!isHttpUrl(download.url)) {
      fail("download.url", "must be an http(s) URL")
    }
  }

  if (!valid) return null
  return raw as unknown as RegistryEntry
}

/**
 * Validate an unknown JSON value as a RegistryIndex.
 * Never throws. Returns `{ ok, entries, errors }`; `ok` is true only when
 * zero problems were found.
 */
export function validateRegistryIndex(json: unknown): RegistryValidationResult {
  const errors: string[] = []
  const entries: RegistryEntry[] = []

  if (!isRecord(json)) {
    return { ok: false, entries, errors: ["root: index must be an object"] }
  }

  if (json.version !== 1) {
    errors.push(`version: must be 1, got ${JSON.stringify(json.version)}`)
  }

  if (!isNonEmptyString(json.updatedAt) || Number.isNaN(Date.parse(json.updatedAt))) {
    errors.push("updatedAt: required (ISO-8601 timestamp string)")
  }

  if (!Array.isArray(json.entries)) {
    errors.push("entries: required (array)")
    return { ok: false, entries, errors }
  }

  const seenIds = new Set<string>()
  json.entries.forEach((raw, i) => {
    const entry = validateEntry(raw, `entries[${i}]`, errors)
    if (!entry) return
    if (seenIds.has(entry.id)) {
      errors.push(`entries[${i}].id: duplicate id "${entry.id}"`)
      return
    }
    seenIds.add(entry.id)
    entries.push(entry)
  })

  return { ok: errors.length === 0, entries, errors }
}
