import { db } from "../db/schema"
import type { SyncRecord } from "../db/schema"

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
  return db.syncQueue
    .where("status")
    .anyOf(["pending", "failed"] satisfies SyncRecordStatus[])
    .toArray()
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
    attempts: status === "in-progress" ? (record.attempts || 0) + 1 : record.attempts,
  })
}

export async function clearCompletedSync() {
  await db.syncQueue.where("status").equals("done").delete()
}

type SyncRecordStatus = SyncRecord["status"]
