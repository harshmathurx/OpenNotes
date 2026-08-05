/**
 * Fetching the community registry index.
 *
 * `fetchRegistryIndex` loads the index JSON (default: the static seed at
 * /registry/index.json, served from public/), validates it, and returns a
 * guaranteed-valid RegistryIndex. It NEVER throws and NEVER hangs:
 *
 *   1. Fresh in-memory cache hit (per url, within cacheTtlMs) → return it.
 *   2. Otherwise fetch with a hard timeout (races the fetch promise, and
 *      aborts via AbortController when the runtime supports it).
 *   3. Success + valid schema → cache and return.
 *   4. ANY failure (network error, non-2xx, bad JSON, schema errors) →
 *      return the last successful cached index for that url if we have one
 *      (stale beats nothing), otherwise the provided fallback — which
 *      defaults to the bundled builtin index.
 *
 * Environment-agnostic: pass `fetchImpl` to inject a stub in tests; the
 * default is the global `fetch`.
 */

import { BUILTIN_REGISTRY_INDEX } from "./builtin"
import { validateRegistryIndex } from "./schema"
import type { RegistryIndex } from "./types"

export const DEFAULT_REGISTRY_URL = "/registry/index.json"
export const DEFAULT_TIMEOUT_MS = 5_000
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000

export interface FetchRegistryIndexOptions {
  /** Index URL. Defaults to "/registry/index.json" (served from public/). */
  url?: string
  /** Fetch implementation. Inject a stub in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Hard timeout in ms. The promise never pends longer than this. */
  timeoutMs?: number
  /** Cache freshness window in ms. 0 disables the cache. */
  cacheTtlMs?: number
  /** Index returned when fetch fails and no cached copy exists. Defaults to the bundled builtin index. */
  fallback?: RegistryIndex
}

interface CacheEntry {
  index: RegistryIndex
  fetchedAt: number
}

/** Module-level in-memory cache, keyed by url. Lives for the app session. */
const cache = new Map<string, CacheEntry>()

/** Drop all cached indexes. Intended for tests and explicit refresh UX. */
export function clearRegistryIndexCache(): void {
  cache.clear()
}

function timeoutSignal(timeoutMs: number): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
      return AbortSignal.timeout(timeoutMs)
    }
  } catch {
    // Runtime without AbortSignal.timeout — the race below still enforces the deadline.
  }
  return undefined
}

/**
 * Fetch and validate the registry index. Always resolves to a valid
 * RegistryIndex; consult the builtin fallback path for offline behaviour.
 */
export async function fetchRegistryIndex(
  options: FetchRegistryIndexOptions = {}
): Promise<RegistryIndex> {
  const {
    url = DEFAULT_REGISTRY_URL,
    fetchImpl,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    cacheTtlMs = DEFAULT_CACHE_TTL_MS,
    fallback = BUILTIN_REGISTRY_INDEX,
  } = options

  const now = Date.now()
  const cached = cache.get(url)
  if (cached && cacheTtlMs > 0 && now - cached.fetchedAt < cacheTtlMs) {
    return cached.index
  }

  const impl =
    fetchImpl ??
    (typeof fetch === "function" ? (fetch.bind(globalThis) as typeof fetch) : undefined)

  if (!impl) {
    // No fetch available (very old/embedded runtime) — straight to fallback.
    return cached?.index ?? fallback
  }

  try {
    const response = await Promise.race([
      impl(url, { signal: timeoutSignal(timeoutMs) }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`registry fetch timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ])

    if (!response.ok) {
      throw new Error(`registry fetch failed with status ${response.status}`)
    }

    const json: unknown = await response.json()
    const result = validateRegistryIndex(json)
    if (!result.ok) {
      throw new Error(`registry index failed validation: ${result.errors.join("; ")}`)
    }

    const index: RegistryIndex = { version: 1, updatedAt: (json as RegistryIndex).updatedAt, entries: result.entries }
    cache.set(url, { index, fetchedAt: Date.now() })
    return index
  } catch {
    // Offline / timeout / bad payload: prefer the last good copy, else the fallback.
    return cached?.index ?? fallback
  }
}
