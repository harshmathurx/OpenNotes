import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"
import { BUILTIN_REGISTRY_INDEX } from "@/core/registry/builtin"
import {
  clearRegistryIndexCache,
  fetchRegistryIndex,
} from "@/core/registry/fetch"
import { validateRegistryIndex } from "@/core/registry/schema"
import type { RegistryEntry, RegistryIndex } from "@/core/registry/types"

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: "my-ext",
    name: "My Ext",
    version: "1.0.0",
    description: "A test extension.",
    author: "Tester",
    repo: "https://github.com/example/my-ext",
    kind: "community",
    download: { type: "repo-dir", url: "https://github.com/example/my-ext/tree/main/extension" },
    ...overrides,
  }
}

function makeIndex(entries: RegistryEntry[]): RegistryIndex {
  return { version: 1, updatedAt: "2026-08-05T00:00:00.000Z", entries }
}

function okFetch(json: unknown): typeof fetch {
  return vi.fn(async () => new Response(JSON.stringify(json), { status: 200 })) as unknown as typeof fetch
}

const failingFetch = vi.fn(async () => {
  throw new Error("network down")
}) as unknown as typeof fetch

const CUSTOM_FALLBACK: RegistryIndex = {
  version: 1,
  updatedAt: "2020-01-01T00:00:00.000Z",
  entries: [
    {
      id: "fallback-ext",
      name: "Fallback",
      version: "0.0.1",
      description: "Offline fallback entry.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes",
      kind: "core",
    },
  ],
}

beforeEach(() => {
  clearRegistryIndexCache()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe("validateRegistryIndex", () => {
  it("accepts the bundled builtin index", () => {
    const result = validateRegistryIndex(BUILTIN_REGISTRY_INDEX)
    expect(result.errors).toEqual([])
    expect(result.ok).toBe(true)
    expect(result.entries).toHaveLength(BUILTIN_REGISTRY_INDEX.entries.length)
  })

  it("keeps the served JSON seed in sync with the builtin index", () => {
    const served = JSON.parse(
      readFileSync(path.join(process.cwd(), "public/registry/index.json"), "utf8")
    )
    expect(validateRegistryIndex(served).ok).toBe(true)
    expect(served).toEqual(BUILTIN_REGISTRY_INDEX)
  })

  it("accepts a valid hand-built index and never throws on junk", () => {
    expect(validateRegistryIndex(makeIndex([makeEntry()])).ok).toBe(true)
    expect(() => validateRegistryIndex(null)).not.toThrow()
    expect(() => validateRegistryIndex("nope")).not.toThrow()
    expect(() => validateRegistryIndex(undefined)).not.toThrow()
    expect(validateRegistryIndex(null).ok).toBe(false)
  })

  it("rejects a wrong document version and a bad updatedAt", () => {
    const badVersion = validateRegistryIndex({ ...makeIndex([makeEntry()]), version: 2 })
    expect(badVersion.ok).toBe(false)
    expect(badVersion.errors.some((e) => e.startsWith("version:"))).toBe(true)

    const badDate = validateRegistryIndex({ ...makeIndex([makeEntry()]), updatedAt: "not-a-date" })
    expect(badDate.ok).toBe(false)
    expect(badDate.errors.some((e) => e.startsWith("updatedAt:"))).toBe(true)
  })

  it("requires id/name/version/description/author/repo/kind on every entry", () => {
    const result = validateRegistryIndex(makeIndex([{ kind: "core" } as unknown as RegistryEntry]))
    expect(result.ok).toBe(false)
    for (const field of ["id", "name", "version", "description", "author", "repo"]) {
      expect(result.errors.some((e) => e.startsWith(`entries[0].${field}:`))).toBe(true)
    }
  })

  it("enforces kebab-case, unique ids", () => {
    const badCase = validateRegistryIndex(makeIndex([makeEntry({ id: "My_Ext" })]))
    expect(badCase.ok).toBe(false)
    expect(badCase.errors.some((e) => e.includes("kebab-case"))).toBe(true)

    const dupes = validateRegistryIndex(
      makeIndex([makeEntry({ id: "dup" }), makeEntry({ id: "dup" })])
    )
    expect(dupes.ok).toBe(false)
    expect(dupes.errors.some((e) => e.includes("duplicate id"))).toBe(true)
    // The first occurrence is kept; only the duplicate is dropped.
    expect(dupes.entries.map((e) => e.id)).toEqual(["dup"])
  })

  it("requires community entries to carry a download with a valid type and URL", () => {
    const noDownload = validateRegistryIndex(makeIndex([makeEntry({ download: undefined })]))
    expect(noDownload.ok).toBe(false)
    expect(noDownload.errors.some((e) => e.startsWith("entries[0].download:"))).toBe(true)

    const badType = validateRegistryIndex(
      makeIndex([makeEntry({ download: { type: "ftp" as never, url: "https://x.test/a.zip" } })])
    )
    expect(badType.ok).toBe(false)
    expect(badType.errors.some((e) => e.startsWith("entries[0].download.type:"))).toBe(true)

    const badUrl = validateRegistryIndex(
      makeIndex([makeEntry({ download: { type: "github-release", url: "not-a-url" } })])
    )
    expect(badUrl.ok).toBe(false)
    expect(badUrl.errors.some((e) => e.startsWith("entries[0].download.url:"))).toBe(true)
  })

  it("forbids a download on core entries and enforces http(s) URLs", () => {
    const coreWithDownload = validateRegistryIndex(
      makeIndex([makeEntry({ kind: "core", download: { type: "repo-dir", url: "https://x.test/dir" } })])
    )
    expect(coreWithDownload.ok).toBe(false)
    expect(coreWithDownload.errors.some((e) => e.includes('must be absent for kind "core"'))).toBe(true)

    const badRepo = validateRegistryIndex(makeIndex([makeEntry({ repo: "ftp://example.com/x" })]))
    expect(badRepo.ok).toBe(false)
    expect(badRepo.errors.some((e) => e.startsWith("entries[0].repo:"))).toBe(true)

    const badHomepage = validateRegistryIndex(makeIndex([makeEntry({ homepage: "not a url" })]))
    expect(badHomepage.ok).toBe(false)
    expect(badHomepage.errors.some((e) => e.startsWith("entries[0].homepage:"))).toBe(true)
  })
})

describe("fetchRegistryIndex", () => {
  it("returns a validated index from the injected fetch", async () => {
    const index = makeIndex([makeEntry()])
    const impl = okFetch(index)

    const result = await fetchRegistryIndex({ fetchImpl: impl })
    expect(result).toEqual(index)
    expect(impl).toHaveBeenCalledWith("/registry/index.json", expect.anything())
  })

  it("falls back to the builtin index when the network fails", async () => {
    const result = await fetchRegistryIndex({ fetchImpl: failingFetch })
    expect(result).toEqual(BUILTIN_REGISTRY_INDEX)
  })

  it("falls back on non-2xx, invalid JSON, and schema-invalid payloads", async () => {
    const notFound = await fetchRegistryIndex({
      fetchImpl: vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch,
    })
    expect(notFound).toEqual(BUILTIN_REGISTRY_INDEX)

    const badJson = await fetchRegistryIndex({
      fetchImpl: vi.fn(async () => new Response("{ not json", { status: 200 })) as unknown as typeof fetch,
    })
    expect(badJson).toEqual(BUILTIN_REGISTRY_INDEX)

    const badSchema = await fetchRegistryIndex({
      fetchImpl: okFetch({ version: 2, updatedAt: "2026-08-05T00:00:00.000Z", entries: [] }),
    })
    expect(badSchema).toEqual(BUILTIN_REGISTRY_INDEX)
  })

  it("honours a caller-provided fallback", async () => {
    const result = await fetchRegistryIndex({ fetchImpl: failingFetch, fallback: CUSTOM_FALLBACK })
    expect(result).toEqual(CUSTOM_FALLBACK)
    expect(result).not.toEqual(BUILTIN_REGISTRY_INDEX)
  })

  it("never throws and resolves with the fallback when the fetch hangs past the timeout", async () => {
    const hangingFetch = vi.fn(
      () => new Promise<Response>(() => {}) // never settles
    ) as unknown as typeof fetch

    const result = await fetchRegistryIndex({ fetchImpl: hangingFetch, timeoutMs: 25 })
    expect(result).toEqual(BUILTIN_REGISTRY_INDEX)
  })

  it("serves subsequent calls from cache within the TTL", async () => {
    const index = makeIndex([makeEntry()])
    const impl = okFetch(index)

    const first = await fetchRegistryIndex({ fetchImpl: impl })
    const second = await fetchRegistryIndex({ fetchImpl: impl })
    expect(first).toEqual(index)
    expect(second).toEqual(index)
    expect(impl).toHaveBeenCalledTimes(1)
  })

  it("refetches after the TTL expires and keeps a separate cache per url", async () => {
    vi.useFakeTimers()
    try {
      const index = makeIndex([makeEntry()])
      const impl = okFetch(index)

      await fetchRegistryIndex({ fetchImpl: impl, cacheTtlMs: 1_000 })
      vi.advanceTimersByTime(1_500)
      await fetchRegistryIndex({ fetchImpl: impl, cacheTtlMs: 1_000 })
      expect(impl).toHaveBeenCalledTimes(2)

      // A different url is a different cache entry.
      const otherImpl = okFetch(makeIndex([makeEntry({ id: "other" })]))
      const other = await fetchRegistryIndex({ url: "/registry/other.json", fetchImpl: otherImpl })
      expect(other.entries[0].id).toBe("other")
      expect(otherImpl).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it("serves a stale cached copy when a later fetch fails", async () => {
    vi.useFakeTimers()
    try {
      const index = makeIndex([makeEntry()])
      const impl = okFetch(index)

      await fetchRegistryIndex({ fetchImpl: impl, cacheTtlMs: 100 })

      vi.advanceTimersByTime(500) // cache now stale
      const result = await fetchRegistryIndex({ fetchImpl: failingFetch, cacheTtlMs: 100 })
      // Stale beats the fallback.
      expect(result).toEqual(index)
      expect(result).not.toEqual(BUILTIN_REGISTRY_INDEX)
    } finally {
      vi.useRealTimers()
    }
  })
})
