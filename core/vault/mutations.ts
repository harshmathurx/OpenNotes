import { db } from "@/core/db/schema"
import type { StorageProvider } from "@/core/storage/types"
import { removeOnDelete, upsertOnWrite } from "@/core/vault/diskMirror"
import { SaveQueue } from "@/core/vault/saveQueue"

export type VaultMutation =
  | { type: "save"; path: string; content: string }
  | { type: "delete"; path: string }
  | { type: "rename"; oldPath: string; newPath: string }

/**
 * The writable slice of a StorageProvider used as the vault's disk backend.
 * When the desktop notes folder is active this is a FolderVaultStore;
 * save/delete/rename hit the folder on disk (source of truth) and mirror
 * into the IndexedDB cache. Omitted (undefined) → IndexedDB-only behavior.
 */
export type VaultBackend = Pick<
  StorageProvider,
  "readFile" | "writeFile" | "deleteFile"
>

export async function applyVaultMutation(
  mutation: VaultMutation,
  backend?: VaultBackend
) {
  if (mutation.type === "save") {
    await saveVaultFile(mutation.path, mutation.content, backend)
    return
  }

  if (mutation.type === "delete") {
    await deleteVaultFile(mutation.path, backend)
    return
  }

  await renameVaultFile(mutation.oldPath, mutation.newPath, backend)
}

export async function saveVaultFile(
  path: string,
  content: string,
  backend?: VaultBackend
) {
  // Route through the write-coalescing queue: rapid saves to the same path
  // (i.e. typing) collapse into ONE persistence call writing the latest
  // content. The queue captures the backend at enqueue time so a batch never
  // spans a backend switch.
  await vaultSaveQueue.save(path, content, { backend })
}

/** The actual (uncoalesced) persistence — the queue's sink. */
async function persistVaultFile(
  path: string,
  content: string,
  ctx: { backend?: VaultBackend }
) {
  if (ctx.backend) {
    // Disk is the source of truth; cache mirrors the fresh entry.
    const entry = await ctx.backend.writeFile(path, content)
    await upsertOnWrite(entry)
    return
  }

  await db.files.put({
    path,
    content,
    lastModified: new Date(),
    synced: true,
    syncPending: false,
  })
}

interface SaveCtx {
  backend?: VaultBackend
}

/**
 * Shared per-path save queue. Module-level so every save in the session
 * coalesces into the same batches regardless of which hook/component fired
 * it. Persisting never blocks typing; flush* force pending writes to land.
 */
export const vaultSaveQueue = new SaveQueue<SaveCtx>((path, content, ctx) =>
  persistVaultFile(path, content, ctx)
)

/** Persist any queued write for `path` immediately (note-switch, Cmd+S). */
export function flushVaultSave(path: string): Promise<void> {
  return vaultSaveQueue.flush(path)
}

/** Persist every queued write immediately (unmount, app-level save). */
export function flushAllVaultSaves(): Promise<void> {
  return vaultSaveQueue.flushAll()
}

export async function deleteVaultFile(path: string, backend?: VaultBackend) {
  // Never delete past a queued write: land the latest content first.
  await vaultSaveQueue.flush(path)

  if (backend) {
    await backend.deleteFile(path)
    await removeOnDelete(path)
    return
  }

  await db.files.delete(path)
}

export async function renameVaultFile(
  oldPath: string,
  newPath: string,
  backend?: VaultBackend
) {
  const target = newPath.endsWith(".md") ? newPath : `${newPath}.md`
  if (target === oldPath) return target

  // Never rename past queued writes on either path: land the latest content
  // first so the rename carries the final save, not a stale snapshot.
  await vaultSaveQueue.flush(oldPath)
  await vaultSaveQueue.flush(target)

  if (backend) {
    // The folder api has no rename primitive: read-old → write-new →
    // delete-old, mirroring each step into the cache.
    const file = (await backend.readFile(oldPath)) ?? (await db.files.get(oldPath))
    if (!file) return null

    const entry = await backend.writeFile(target, file.content)
    await backend.deleteFile(oldPath)
    await removeOnDelete(oldPath)
    await upsertOnWrite(entry)
    return target
  }

  const file = await db.files.get(oldPath)
  if (!file) return null

  await db.files.delete(oldPath)
  await db.files.put({
    ...file,
    path: target,
    lastModified: new Date(),
    synced: true,
    syncPending: false,
  })

  return target
}
