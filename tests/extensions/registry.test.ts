import { describe, expect, it, beforeEach } from "vitest"
import { extensionRegistry } from "@/core/extensions/registry"
import {
  EXTENSIONS_STORAGE_KEY,
  loadEnabledState,
} from "@/core/extensions/store"
import { loadBundledExtensions, resetLoaderForTests } from "@/core/extensions/loader"
import type { OpenNotesExtension } from "@/core/extensions/types"

function makeExtension(id: string): OpenNotesExtension {
  return {
    manifest: {
      id,
      name: `Ext ${id}`,
      version: "1.0.0",
      description: `Test extension ${id}`,
    },
    activate(ctx) {
      ctx.registerCommand({
        id: "hello",
        title: `Hello from ${id}`,
        run() {},
      })
      ctx.registerSlashItem({
        id: "snippet",
        title: `Snippet from ${id}`,
        insert: () => `# from ${id}`,
      })
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  extensionRegistry.reset()
  resetLoaderForTests()
})

describe("extension registry", () => {
  it("registers an extension and lists it as enabled by default", () => {
    extensionRegistry.register(makeExtension("alpha"))

    const list = extensionRegistry.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({
      manifest: { id: "alpha", name: "Ext alpha", version: "1.0.0" },
      enabled: true,
    })
    expect(list[0].commands.map((c) => c.id)).toEqual(["hello"])
    expect(list[0].slashItems.map((s) => s.id)).toEqual(["snippet"])
  })

  it("looks up commands and slash items by namespaced key", () => {
    extensionRegistry.register(makeExtension("alpha"))

    const cmd = extensionRegistry.getCommand("alpha:hello")
    expect(cmd?.command.title).toBe("Hello from alpha")

    const item = extensionRegistry.getSlashItem("alpha:snippet")
    expect(item?.item.title).toBe("Snippet from alpha")

    expect(extensionRegistry.getCommand("alpha:nope")).toBeNull()
    expect(extensionRegistry.getCommand("missing:hello")).toBeNull()
    expect(extensionRegistry.getCommand("bad-key")).toBeNull()
  })

  it("only exposes commands and slash items from enabled extensions", () => {
    extensionRegistry.register(makeExtension("alpha"))
    extensionRegistry.register(makeExtension("beta"))

    expect(extensionRegistry.getCommands()).toHaveLength(2)
    expect(extensionRegistry.getSlashItems()).toHaveLength(2)

    extensionRegistry.setEnabled("alpha", false)

    const commands = extensionRegistry.getCommands()
    expect(commands).toHaveLength(1)
    expect(commands[0].extensionId).toBe("beta")
    expect(extensionRegistry.getCommand("alpha:hello")).toBeNull()

    const items = extensionRegistry.getSlashItems()
    expect(items).toHaveLength(1)
    expect(items[0].extensionId).toBe("beta")
    expect(extensionRegistry.getSlashItem("alpha:snippet")).toBeNull()

    // Disabled extensions remain listed for the management UI.
    expect(extensionRegistry.list().map((e) => e.manifest.id)).toEqual([
      "alpha",
      "beta",
    ])
    expect(extensionRegistry.isEnabled("alpha")).toBe(false)
  })

  it("notifies subscribers on register, unregister, and enable/disable", () => {
    const seen: string[] = []
    const unsubscribe = extensionRegistry.subscribe(() => {
      seen.push(extensionRegistry.list().map((e) => e.manifest.id).join(","))
    })

    extensionRegistry.register(makeExtension("alpha"))
    extensionRegistry.setEnabled("alpha", false)
    extensionRegistry.unregister("alpha")
    unsubscribe()
    extensionRegistry.register(makeExtension("beta"))

    expect(seen).toEqual(["alpha", "alpha", ""])
  })

  it("persists enabled state to localStorage and restores it on re-register", () => {
    extensionRegistry.register(makeExtension("alpha"))
    extensionRegistry.setEnabled("alpha", false)

    const raw = localStorage.getItem(EXTENSIONS_STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({ alpha: false })
    expect(loadEnabledState()).toEqual({ alpha: false })

    // Simulate a reload: fresh registry, same localStorage.
    extensionRegistry.reset()
    extensionRegistry.register(makeExtension("alpha"))
    expect(extensionRegistry.isEnabled("alpha")).toBe(false)

    extensionRegistry.setEnabled("alpha", true)
    expect(loadEnabledState()).toEqual({ alpha: true })
  })

  it("returns an empty state map from corrupt persisted JSON", () => {
    localStorage.setItem(EXTENSIONS_STORAGE_KEY, "{not json")
    expect(loadEnabledState()).toEqual({})

    localStorage.setItem(EXTENSIONS_STORAGE_KEY, JSON.stringify([1, 2]))
    expect(loadEnabledState()).toEqual({})
  })

  it("loads the bundled extensions and applies persisted state", () => {
    localStorage.setItem(
      EXTENSIONS_STORAGE_KEY,
      JSON.stringify({ export: false })
    )

    const loaded = loadBundledExtensions()
    const ids = loaded.map((e) => e.manifest.id)
    expect(ids).toEqual([
      "git-sync",
      "templates",
      "export",
      "backlinks",
      "ai-cowriter",
    ])

    expect(extensionRegistry.isEnabled("export")).toBe(false)
    expect(extensionRegistry.isEnabled("templates")).toBe(true)

    // AI Co-Writer ships disabled by default (opt-in pillar).
    expect(extensionRegistry.isEnabled("ai-cowriter")).toBe(false)

    // Disabled extension contributes no commands.
    const commandExtensions = extensionRegistry
      .getCommands()
      .map((c) => c.extensionId)
    expect(commandExtensions).not.toContain("export")
    expect(commandExtensions).toContain("templates")

    // Idempotent: a second call doesn't duplicate registrations.
    loadBundledExtensions()
    expect(extensionRegistry.list()).toHaveLength(5)
  })
})
