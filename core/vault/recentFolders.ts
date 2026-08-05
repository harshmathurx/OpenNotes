/**
 * recentFolders — the "switch between notes folders" list.
 *
 * A small, pure, localStorage-backed MRU list of notes folder paths.
 * Most-recent-first, deduped, capped at MAX_RECENT_FOLDERS. Every read is
 * re-hydrated from storage so the list stays correct across windows and
 * after external edits; every write is best-effort (quota failures are
 * non-fatal). Pure + testable: no React, no Tauri, no toast side effects.
 */

export const RECENT_FOLDERS_STORAGE_KEY = "opennotes-recent-folders"

export const MAX_RECENT_FOLDERS = 8

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

function isValidList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0)
  )
}

/**
 * The recent notes folders, most-recent-first. Returns [] when unset or
 * when the stored value is unreadable/corrupt.
 */
export function getRecentFolders(): string[] {
  const storage = safeLocalStorage()
  if (!storage) return []
  try {
    const raw = storage.getItem(RECENT_FOLDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!isValidList(parsed)) return []
    // Defensive: enforce invariants even if the stored value drifted.
    const deduped = [...new Set(parsed)]
    return deduped.slice(0, MAX_RECENT_FOLDERS)
  } catch {
    return []
  }
}

function persist(folders: string[]): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.setItem(RECENT_FOLDERS_STORAGE_KEY, JSON.stringify(folders))
  } catch {
    // Quota failures are non-fatal; the in-memory caller already applied.
  }
}

/**
 * Add a path as the most-recent folder. Dedupes (an existing entry moves
 * to the front), caps the list at MAX_RECENT_FOLDERS, and persists.
 * Returns the updated list.
 */
export function addRecentFolder(path: string): string[] {
  if (!path) return getRecentFolders()
  const next = [path, ...getRecentFolders().filter((p) => p !== path)].slice(
    0,
    MAX_RECENT_FOLDERS
  )
  persist(next)
  return next
}

/** Remove a path from the list (no-op when absent). Returns the list. */
export function removeRecentFolder(path: string): string[] {
  const next = getRecentFolders().filter((p) => p !== path)
  persist(next)
  return next
}

/** Clear the entire recent-folders list. */
export function clearRecentFolders(): void {
  const storage = safeLocalStorage()
  if (!storage) return
  try {
    storage.removeItem(RECENT_FOLDERS_STORAGE_KEY)
  } catch {
    // Non-fatal.
  }
}
