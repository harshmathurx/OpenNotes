import { db } from "../db/schema"

export async function enqueueSyncAction(
  path: string,
  action: "write" | "delete",
  content?: string
) {
  await db.syncQueue.put({
    path,
    action,
    content,
    timestamp: new Date(),
    status: "pending",
    attempts: 0,
  })
}

export async function getPendingSyncActions() {
  return db.syncQueue.where("status").equals("pending").toArray()
}

export async function markSyncAttempt(
  id: number,
  status: SyncRecordStatus,
  error?: string
) {
  const record = await db.syncQueue.get(id)
  if (!record) return
  await db.syncQueue.update(id, {
    status,
    error,
    attempts: (record.attempts || 0) + 1,
  })
}

export async function clearCompletedSync() {
  await db.syncQueue.where("status").equals("done").delete()
}

import type { SyncRecord } from "../db/schema"
type SyncRecordStatus = SyncRecord["status"]
