import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/core/db/schema"
import { getPendingSyncActions } from "@/core/sync/queue"
import { applyVaultMutation } from "@/core/vault/mutations"

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe("vault mutations sync queue", () => {
  it("does not enqueue local-only saves", async () => {
    await applyVaultMutation({ type: "save", path: "a.md", content: "A", remoteActive: false })

    expect(await getPendingSyncActions()).toEqual([])
    expect(await db.files.get("a.md")).toMatchObject({
      content: "A",
      synced: true,
      syncPending: false,
    })
  })

  it("enqueues writes, deletes, and renames only when remote is active", async () => {
    await applyVaultMutation({ type: "save", path: "a.md", content: "A", remoteActive: true })
    await applyVaultMutation({ type: "rename", oldPath: "a.md", newPath: "b.md", remoteActive: true })
    await applyVaultMutation({ type: "delete", path: "b.md", remoteActive: true })

    const pending = await getPendingSyncActions()
    expect(pending.map((item) => ({ path: item.path, action: item.action, content: item.content }))).toEqual([
      { path: "a.md", action: "write", content: "A" },
      { path: "a.md", action: "delete", content: undefined },
      { path: "b.md", action: "write", content: "A" },
      { path: "b.md", action: "delete", content: undefined },
    ])
  })
})
