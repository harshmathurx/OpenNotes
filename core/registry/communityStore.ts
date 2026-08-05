/**
 * Persistence for installed community extension modules.
 *
 * Each installed extension is stored under the key
 * `opennotes-community-ext:<id>` as JSON:
 *
 *   { manifest, source, installedAt, enabled }
 *
 * The API is async and backend-injectable so a Tauri fs-backed store
 * (reading/writing a real `extensions/` folder via core/bridge/fs.ts
 * `tauriFolder`) can slot in on the desktop app without touching any
 * caller. PLUG-IN POINT: implement `CommunityStoreBackend` over
 * `tauriFolder.readFile/writeFile/deleteFile/listMarkdown` against an
 * app-managed extensions directory and pass it as `backend` wherever a
 * store is created.
 *
 * The default backend is localStorage. That is a DEV-ONLY fallback: it
 * exists so the install/load flow is exercisable in the browser and in
 * tests. Extension source stored this way shares the origin's storage
 * quota and is not a durable desktop install — the Mac app should ship
 * the fs backend above.
 */

import type { ExtensionManifest } from "@/core/extensions/types"

export const COMMUNITY_STORAGE_PREFIX = "opennotes-community-ext:"

/** One installed community extension, persisted. */
export interface InstalledCommunityModule {
  manifest: ExtensionManifest
  /** The raw ES module source (single-file, dependency-free). */
  source: string
  /** ISO-8601 timestamp of install. */
  installedAt: string
  /** Whether the loader should activate this module. */
  enabled: boolean
}

/** Async storage backend. All methods must resolve, never throw. */
export interface CommunityStoreBackend {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
  /** Every stored raw value (across all extension keys). */
  values(): Promise<string[]>
}

export interface CommunityStore {
  save(module: InstalledCommunityModule): Promise<void>
  get(id: string): Promise<InstalledCommunityModule | null>
  remove(id: string): Promise<void>
  list(): Promise<InstalledCommunityModule[]>
}

function storageKey(id: string): string {
  return `${COMMUNITY_STORAGE_PREFIX}${id}`
}

/** Parse a stored JSON value into an InstalledCommunityModule. Null on any malformation. */
function parseStored(raw: string | null): InstalledCommunityModule | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null
    const record = parsed as Record<string, unknown>
    if (
      typeof record.manifest !== "object" ||
      record.manifest === null ||
      typeof record.source !== "string" ||
      typeof record.installedAt !== "string" ||
      typeof record.enabled !== "boolean"
    ) {
      return null
    }
    return parsed as InstalledCommunityModule
  } catch {
    return null
  }
}

/**
 * localStorage backend. DEV-ONLY fallback — see the header. Every method
 * degrades to a no-op/null when storage is unavailable (SSR, quota).
 */
export function createLocalStorageBackend(): CommunityStoreBackend {
  function safeLocalStorage(): Storage | null {
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage
      if (typeof localStorage !== "undefined") return localStorage
      return null
    } catch {
      return null
    }
  }

  return {
    async get(key) {
      try {
        return safeLocalStorage()?.getItem(key) ?? null
      } catch {
        return null
      }
    },
    async set(key, value) {
      try {
        safeLocalStorage()?.setItem(key, value)
      } catch {
        // Quota/serialization failures are non-fatal: install just won't persist.
      }
    },
    async remove(key) {
      try {
        safeLocalStorage()?.removeItem(key)
      } catch {
        // Non-fatal.
      }
    },
    async values() {
      const storage = safeLocalStorage()
      if (!storage) return []
      try {
        const out: string[] = []
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i)
          if (!key || !key.startsWith(COMMUNITY_STORAGE_PREFIX)) continue
          const value = storage.getItem(key)
          if (value !== null) out.push(value)
        }
        return out
      } catch {
        return []
      }
    },
  }
}

export interface CreateCommunityStoreOptions {
  /** Inject a backend (tests, or the future Tauri fs implementation). Defaults to localStorage. */
  backend?: CommunityStoreBackend
}

/**
 * Create the community extension store. Never throws; all operations
 * resolve (to null/[] on failure) so callers stay degrade-safe.
 */
export function createCommunityStore(options: CreateCommunityStoreOptions = {}): CommunityStore {
  const backend = options.backend ?? createLocalStorageBackend()

  return {
    async save(module) {
      await backend.set(storageKey(module.manifest.id), JSON.stringify(module))
    },
    async get(id) {
      return parseStored(await backend.get(storageKey(id)))
    },
    async remove(id) {
      await backend.remove(storageKey(id))
    },
    async list() {
      const raws = await backend.values()
      const out: InstalledCommunityModule[] = []
      for (const raw of raws) {
        const parsed = parseStored(raw)
        if (parsed) out.push(parsed)
      }
      // Stable order: by install time, then id — deterministic for tests and UI.
      out.sort(
        (a, b) =>
          a.installedAt.localeCompare(b.installedAt) || a.manifest.id.localeCompare(b.manifest.id)
      )
      return out
    },
  }
}

/** Shared default store (localStorage backend). */
export const communityStore = createCommunityStore()
