import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/core/db/schema"
import { buildVaultMarkdownZip, exportVaultAsMarkdownZip } from "@/core/export/zip"

async function resetDb() {
  await db.delete()
  await db.open()
}

describe("vault markdown zip export", () => {
  beforeEach(resetDb)

  it("exports each local note as an uncompressed markdown entry", async () => {
    await db.files.bulkPut([
      {
        path: "Inbox.md",
        content: "# Inbox\n\nHello",
        lastModified: new Date("2026-01-01T00:00:00Z"),
        synced: true,
        syncPending: false,
      },
      {
        path: "projects/OpenNotes plan.md",
        content: "- [x] export",
        lastModified: new Date("2026-01-02T00:00:00Z"),
        synced: true,
        syncPending: false,
      },
    ])

    const blob = await exportVaultAsMarkdownZip()
    const zipText = await blob.text()

    expect(blob.type).toBe("application/zip")
    expect(zipText).toContain("Inbox.md")
    expect(zipText).toContain("# Inbox\n\nHello")
    expect(zipText).toContain("projects/OpenNotes plan.md")
    expect(zipText).toContain("- [x] export")
    expect(zipText.startsWith("PK\u0003\u0004")).toBe(true)
  })

  it("sanitizes unsafe archive paths without flattening nested folders", () => {
    const zip = buildVaultMarkdownZip([
      {
        path: "../escape.md",
        content: "nope",
        lastModified: new Date("2026-01-01T00:00:00Z"),
      },
      {
        path: "/absolute/fine.md",
        content: "ok",
        lastModified: new Date("2026-01-01T00:00:00Z"),
      },
    ])

    const text = new TextDecoder().decode(zip)
    expect(text).not.toContain("../escape.md")
    expect(text).toContain("escape.md")
    expect(text).toContain("absolute/fine.md")
  })
})
