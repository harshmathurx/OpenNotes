import { isTauri } from "@/core/bridge/runtime"

/**
 * notesFolder — THE single source of truth for "where the notes live on disk".
 *
 * In the Tauri desktop app the notes folder on disk is the one truth; every
 * consumer that needs that path (the vault's FolderVaultStore, the git-sync
 * extension, settings) reads it from here so they all agree by construction.
 * The git repo root IS the notes folder — same path, one folder.
 *
 * The path is persisted to localStorage under NOTES_FOLDER_STORAGE_KEY and
 * held in a module-level cache so reads are synchronous. Subscribers are
 * notified on change via onNotesFolderChange so vault + git + settings react
 * to the same folder at the same time.
 *
 * Migration: on first read, if the new key is unset but git-sync's legacy
 * per-extension storage ("opennotes-ext-storage:git-sync:repoPath") holds a
 * path, we adopt it and persist it under the shared key — so an existing
 * user's picked repo folder becomes the notes folder with no re-pick.
 */

export const NOTES_FOLDER_STORAGE_KEY = "opennotes-notes-folder"

/** Legacy git-sync repo path key (api.storage namespaced by extension id). */
const LEGACY_GIT_REPO_PATH_KEY = "opennotes-ext-storage:git-sync:repoPath"

type Listener = (path: string | null) => void

let cache: string | null | undefined // undefined = not yet hydrated
const listeners = new Set<Listener>()

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Hydrate the cache from localStorage, running the one-time git migration. */
function hydrate(): string | null {
  const storage = safeLocalStorage()
  if (!storage) {
    cache = null
    return cache
  }
  try {
    const stored = storage.getItem(NOTES_FOLDER_STORAGE_KEY)
    if (stored) {
      cache = stored
      return cache
    }
    // One-time migration: adopt the legacy git-sync repo path, if any.
    const legacy = storage.getItem(LEGACY_GIT_REPO_PATH_KEY)
    if (legacy) {
      storage.setItem(NOTES_FOLDER_STORAGE_KEY, legacy)
      cache = legacy
      return cache
    }
    cache = null
    return cache
  } catch {
    cache = null
    return cache
  }
}

function emit(path: string | null): void {
  for (const cb of listeners) {
    try {
      cb(path)
    } catch {
      // A throwing subscriber must not break the others.
    }
  }
}

/**
 * The notes folder path, or null when none is set. Synchronous (module
 * cache hydrated from localStorage on first read). Runs the git migration.
 */
export function getNotesFolder(): string | null {
  if (cache !== undefined) return cache
  return hydrate()
}

/** True when running in the Tauri desktop shell (disk access exists). */
export function isDesktop(): boolean {
  return isTauri()
}

/** Persist the notes folder path and notify subscribers. */
export function setNotesFolder(path: string): void {
  const storage = safeLocalStorage()
  if (storage) {
    try {
      storage.setItem(NOTES_FOLDER_STORAGE_KEY, path)
    } catch {
      // Quota failures are non-fatal; the in-memory cache still updates.
    }
  }
  if (cache === path) return
  cache = path
  emit(path)
}

/** Clear the notes folder path and notify subscribers. */
export function clearNotesFolder(): void {
  const storage = safeLocalStorage()
  if (storage) {
    try {
      storage.removeItem(NOTES_FOLDER_STORAGE_KEY)
    } catch {
      // Non-fatal.
    }
  }
  if (cache === null || cache === undefined) {
    cache = null
    return
  }
  cache = null
  emit(null)
}

/**
 * Subscribe to notes-folder changes. Returns an unsubscribe function.
 * The callback fires with the new path (or null after clearNotesFolder).
 */
export function onNotesFolderChange(cb: Listener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
