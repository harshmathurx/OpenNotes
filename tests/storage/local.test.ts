import { describe, expect, it, beforeEach } from "vitest"
import { runProviderTests } from "./provider-test-helpers"
import { LocalProvider } from "@/core/storage/local"
import { db } from "@/core/db/schema"

async function resetDb() {
  await db.delete()
  await db.open()
}

runProviderTests("Local", () => new LocalProvider(), resetDb)

describe("LocalProvider reliability", () => {
  let provider: LocalProvider

  beforeEach(async () => {
    await resetDb()
    provider = new LocalProvider()
  })

  it("marks browser-only writes as saved locally instead of sync-pending", async () => {
    await provider.writeFile("local.md", "saved")

    const record = await db.files.get("local.md")
    expect(record).toMatchObject({
      path: "local.md",
      content: "saved",
      synced: true,
      syncPending: false,
    })
  })

  it("persists saved files after IndexedDB is closed and reopened", async () => {
    await provider.writeFile("reload.md", "survives reload")

    db.close()
    await db.open()

    await expect(provider.readFile("reload.md")).resolves.toMatchObject({
      path: "reload.md",
      content: "survives reload",
    })
  })

  it("renames a saved note without losing content", async () => {
    await provider.writeFile("Draft.md", "rename me")

    await provider.renameFile("Draft.md", "Archive/Draft.md")

    await expect(provider.readFile("Draft.md")).resolves.toBeNull()
    await expect(provider.readFile("Archive/Draft.md")).resolves.toMatchObject({
      content: "rename me",
    })
  })

  it("preserves nested paths, large content, and supported special filename characters", async () => {
    const path = "Projects/OpenNotes/Ideas & loose ends (v2).md"
    const content = `# Large note\n\n${"0123456789abcdef".repeat(16_384)}`

    await provider.writeFile(path, content)
    const file = await provider.readFile(path)

    expect(file).toMatchObject({ path, content })
    expect(file!.content).toHaveLength(content.length)
  })
})
