/**
 * Persistence for extension enabled-state.
 *
 * Stores a plain JSON map of `{ [extensionId]: boolean }` under the
 * localStorage key "opennotes-extensions". No secrets, no code — just
 * user preference. Missing entries mean "default" (enabled).
 */

export const EXTENSIONS_STORAGE_KEY = "opennotes-extensions"

export type EnabledStateMap = Record<string, boolean>

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Read the persisted enabled-state map. Returns {} on any parse/storage failure. */
export function loadEnabledState(): EnabledStateMap {
  const storage = safeLocalStorage()
  if (!storage) return {}
  try {
    const raw = storage.getItem(EXTENSIONS_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {}
    }
    const map: EnabledStateMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "boolean") map[key] = value
    }
    return map
  } catch {
    return {}
  }
}

/** Persist the enabled-state map. No-op when storage is unavailable. */
export function saveEnabledState(map: EnabledStateMap): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.setItem(EXTENSIONS_STORAGE_KEY, JSON.stringify(map))
  } catch {
    // Quota/serialization failures are non-fatal: state just won't persist.
  }
}

/** Persist a single extension's enabled flag, merged with existing state. */
export function persistEnabled(extensionId: string, enabled: boolean): void {
  const map = loadEnabledState()
  map[extensionId] = enabled
  saveEnabledState(map)
}
