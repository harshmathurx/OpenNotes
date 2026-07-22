import { db } from "@/core/db/schema"
import { enqueueSyncAction } from "@/core/sync/queue"

export type VaultMutation =
  | { type: "save"; path: string; content: string; remoteActive: boolean }
  | { type: "delete"; path: string; remoteActive: boolean }
  | { type: "rename"; oldPath: string; newPath: string; remoteActive: boolean }

export async function applyVaultMutation(mutation: VaultMutation) {
  if (mutation.type === "save") {
    await saveVaultFile(mutation.path, mutation.content, mutation.remoteActive)
    return
  }

  if (mutation.type === "delete") {
    await deleteVaultFile(mutation.path, mutation.remoteActive)
    return
  }

  await renameVaultFile(mutation.oldPath, mutation.newPath, mutation.remoteActive)
}

export async function saveVaultFile(
  path: string,
  content: string,
  remoteActive: boolean
) {
  await db.files.put({
    path,
    content,
    lastModified: new Date(),
    synced: !remoteActive,
    syncPending: remoteActive,
  })

  if (remoteActive) {
    await enqueueSyncAction(path, "write", content)
  }
}

export async function deleteVaultFile(path: string, remoteActive: boolean) {
  await db.files.delete(path)

  if (remoteActive) {
    await enqueueSyncAction(path, "delete")
  }
}

export async function renameVaultFile(
  oldPath: string,
  newPath: string,
  remoteActive: boolean
) {
  const target = newPath.endsWith(".md") ? newPath : `${newPath}.md`
  if (target === oldPath) return target

  const file = await db.files.get(oldPath)
  if (!file) return null

  await db.files.delete(oldPath)
  await db.files.put({
    ...file,
    path: target,
    lastModified: new Date(),
    synced: !remoteActive,
    syncPending: remoteActive,
  })

  if (remoteActive) {
    await enqueueSyncAction(oldPath, "delete")
    await enqueueSyncAction(target, "write", file.content)
  }

  return target
}
