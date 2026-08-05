import { db, type LocalFile } from "@/core/db/schema"
import type { StorageProvider } from "@/core/storage/types"

/**
 * diskMirror — the read-through cache layer between the notes folder on
 * disk (source of truth, via FolderVaultStore) and the IndexedDB `files`
 * table (reactive cache that backs the UI list + offline access).
 *
 * Write path: mutations write to disk first, then mirror the fresh entry
 * into the cache (upsertOnWrite / removeOnDelete) so `db.files` stays the
 * live source for the UI.
 *
 * Reconcile path: reconcileFromDisk merges a full disk listing into the
 * cache. Disk wins on content; the cache keeps its sync bookkeeping
 * (synced / syncPending) unless the row is new. When both sides changed
 * since they were last in sync, the cache copy is preserved as a
 * "<name> (conflict).md" note and disk still wins the canonical path.
 */

export interface ReconcileResult {
  added: string[]
  updated: string[]
  removed: string[]
  conflicts: string[]
}

type DiskStore = Pick<StorageProvider, "writeFile">

/**
 * Mirror a disk write into the cache. `lastModified` comes from the disk
 * result (mtime is the source of truth). The disk write already happened,
 * so there is nothing to sync: synced:true, syncPending:false.
 */
export async function upsertOnWrite(entry: {
  path: string
  content: string
  lastModified: Date
}): Promise<void> {
  await db.files.put({
    path: entry.path,
    content: entry.content,
    lastModified: entry.lastModified,
    synced: true,
    syncPending: false,
  })
}

/** Mirror a disk delete into the cache. */
export async function removeOnDelete(path: string): Promise<void> {
  await db.files.delete(path)
}

function baseName(path: string): string {
  return path.endsWith(".md") ? path.slice(0, -".md".length) : path
}

/**
 * Merge the current disk state into the cache.
 *
 * Rules (disk is the source of truth):
 * - On disk, not in cache        → added.
 * - On disk, content differs     → updated; if the cache row also drifted
 *   from what disk held at `lastModified` (both sides changed), the cache
 *   content is first preserved as "<name> (conflict).md" → conflicts.
 * - In cache, not on disk        → removed, unless the row has a pending
 *   sync to a remote provider (it may legitimately not exist on disk yet).
 * - Identical content            → untouched (counts as neither add nor
 *   update; mtime-only drift is left alone).
 */
export async function reconcileFromDisk(
  entries: { path: string; content: string; lastModified: Date }[],
  disk?: DiskStore
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    added: [],
    updated: [],
    removed: [],
    conflicts: [],
  }

  const cached = await db.files.toArray()
  const cacheByPath = new Map<string, LocalFile>(
    cached.map((f) => [f.path, f])
  )
  const diskPaths = new Set(entries.map((e) => e.path))

  // Disk → cache.
  for (const entry of entries) {
    const existing = cacheByPath.get(entry.path)

    if (!existing) {
      await db.files.put({
        path: entry.path,
        content: entry.content,
        lastModified: entry.lastModified,
        synced: true,
        syncPending: false,
      })
      result.added.push(entry.path)
      continue
    }

    if (existing.content === entry.content) continue

    // True conflict: both sides changed since they were last in sync.
    // Approximation of "cache changed since last disk sync": the cache
    // row is newer than the last-known disk mtime.
    const bothChanged =
      existing.lastModified.getTime() > entry.lastModified.getTime()

    if (bothChanged) {
      const conflictPath = `${baseName(entry.path)} (conflict).md`
      const conflict: LocalFile = {
        path: conflictPath,
        content: existing.content,
        lastModified: existing.lastModified,
        synced: existing.synced,
        syncPending: existing.syncPending,
      }
      await db.files.put(conflict)
      result.conflicts.push(conflictPath)
      // Keep the conflict copy on disk too when a store is available, so
      // the desktop source of truth doesn't silently lose the local edit.
      if (disk) {
        try {
          await disk.writeFile(conflictPath, existing.content)
        } catch {
          // Best effort — the cache copy is the safety net.
        }
      }
    }

    // Disk wins the canonical path.
    await db.files.put({
      ...existing,
      content: entry.content,
      lastModified: entry.lastModified,
    })
    result.updated.push(entry.path)
  }

  // Cache → disk: rows that vanished from disk are removed, unless they
  // carry a pending remote sync (queued write the disk layer never saw).
  for (const file of cached) {
    if (!diskPaths.has(file.path)) {
      if (file.syncPending) continue
      await db.files.delete(file.path)
      result.removed.push(file.path)
    }
  }

  return result
}
