import { describe, it, expect, beforeEach, afterEach } from "vitest"
import type { StorageProvider } from "@/core/storage/types"

export function runProviderTests(
  name: string,
  createProvider: () => StorageProvider,
  setup?: () => Promise<void>,
  teardown?: () => Promise<void>
) {
  describe(`${name} StorageProvider`, () => {
    let provider: StorageProvider

    beforeEach(async () => {
      if (setup) await setup()
      provider = createProvider()
      await provider.connect()
    })

    afterEach(async () => {
      await provider.disconnect()
      if (teardown) await teardown()
    })

    it("starts empty", async () => {
      const files = await provider.listFiles()
      expect(files).toEqual([])
    })

    it("writes and reads a file", async () => {
      await provider.writeFile("hello.md", "# Hello")
      const file = await provider.readFile("hello.md")
      expect(file).not.toBeNull()
      expect(file!.content).toBe("# Hello")
    })

    it("lists files", async () => {
      await provider.writeFile("a.md", "A")
      await provider.writeFile("b.md", "B")
      const files = await provider.listFiles()
      expect(files).toHaveLength(2)
      expect(files.map((f) => f.path)).toContain("a.md")
      expect(files.map((f) => f.path)).toContain("b.md")
    })

    it("updates a file", async () => {
      await provider.writeFile("x.md", "v1")
      await provider.writeFile("x.md", "v2")
      const second = await provider.readFile("x.md")
      expect(second!.content).toBe("v2")
    })

    it("deletes a file", async () => {
      await provider.writeFile("delete-me.md", "bye")
      await provider.deleteFile("delete-me.md")
      const file = await provider.readFile("delete-me.md")
      expect(file).toBeNull()
    })

    it("handles paths with folders", async () => {
      await provider.writeFile("notes/ideas.md", "idea")
      const file = await provider.readFile("notes/ideas.md")
      expect(file).not.toBeNull()
      expect(file!.content).toBe("idea")
    })
  })
}
