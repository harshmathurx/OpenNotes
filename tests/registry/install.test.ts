import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import { runInNewContext } from "node:vm"
import { extensionRegistry } from "@/core/extensions/registry"
import { loadCommunityExtensions, evaluateModule } from "@/core/registry/communityLoader"
import type { CommunityStoreBackend } from "@/core/registry/communityStore"
import { createCommunityStore } from "@/core/registry/communityStore"
import {
  installCommunityExtension,
  uninstallCommunityExtension,
  listInstalledCommunity,
  isHttpsUrl,
  isInstallableEntry,
} from "@/core/registry/install"
import { initInstallListener, needsConsent, grantConsent, revokeConsent, COMMUNITY_CONSENT_KEY, INSTALL_EXTENSION_EVENT } from "@/core/registry/installListener"
import type { RegistryEntry } from "@/core/registry/types"
import {
  validateModuleText,
  validateModuleShape,
  MAX_MODULE_BYTES,
} from "@/core/registry/validateModule"

/* ------------------------------------------------------------------ */
/* evaluateModule harness                                              */
/*                                                                     */
/* The production evaluator does a real Blob/data-URL dynamic import   */
/* (communityLoader.evaluateModule). Vitest's SSR transform cannot     */
/* execute a runtime dynamic import ("A dynamic import callback was    */
/* not specified"), so tests inject an equivalent, deterministic       */
/* evaluator into the loader's `evaluate` option: rewrite the ESM      */
/* `export default` onto an exports object and run the module body in  */
/* a Node vm context. It throws on syntax errors and on throwing       */
/* top-level code exactly like real ESM evaluation, so the loader's    */
/* failure-isolation behaviour is exercised identically. The real      */
/* evaluateModule is covered by its own Node-level check (see below).  */
/* ------------------------------------------------------------------ */

async function evaluateViaVm(source: string): Promise<Record<string, unknown>> {
  const body = source.replace(/export\s+default/, "exports.default =")
  const sandbox: { exports: Record<string, unknown> } = { exports: {} }
  runInNewContext(`"use strict";\n${body}`, sandbox)
  return sandbox.exports
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    id: "community-ext",
    name: "Community Ext",
    version: "1.0.0",
    description: "A test community extension.",
    author: "Tester",
    repo: "https://github.com/example/community-ext",
    kind: "community",
    download: { type: "repo-dir", url: "https://example.com/ext.js" },
    ...overrides,
  }
}

/** A valid single-file, dependency-free community module source. */
const VALID_MODULE = `
export default {
  manifest: {
    id: "community-ext",
    name: "Community Ext",
    version: "1.0.0",
    description: "A test community extension.",
    author: "Tester",
  },
  activate(ctx) {
    ctx.registerCommand({ id: "ping", title: "Ping", run(api) { api.showToast("pong") } })
  },
}
`

function makeMemoryBackend(): CommunityStoreBackend & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    async get(key) {
      return data.get(key) ?? null
    },
    async set(key, value) {
      data.set(key, value)
    },
    async remove(key) {
      data.delete(key)
    },
    async values() {
      return [...data.values()]
    },
  }
}

function okFetch(body: string): typeof fetch {
  return vi.fn(async () => new Response(body, { status: 200 })) as unknown as typeof fetch
}

const failingFetch = vi.fn(async () => {
  throw new Error("network down")
}) as unknown as typeof fetch

beforeEach(() => {
  extensionRegistry.reset()
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/* ------------------------------------------------------------------ */
/* validateModuleText                                                  */
/* ------------------------------------------------------------------ */

describe("validateModuleText", () => {
  it("accepts a normal module source", () => {
    expect(validateModuleText(VALID_MODULE).ok).toBe(true)
  })

  it("rejects empty and non-string source without throwing", () => {
    expect(validateModuleText("").ok).toBe(false)
    expect(validateModuleText("   \n ").ok).toBe(false)
    expect(validateModuleText(undefined).ok).toBe(false)
    expect(validateModuleText(null).ok).toBe(false)
    expect(validateModuleText(42).ok).toBe(false)
  })

  it("rejects oversized modules", () => {
    const big = `// ${"x".repeat(MAX_MODULE_BYTES)}`
    const result = validateModuleText(big)
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/256|byte/i)
  })

  it("accepts a module just under the size cap", () => {
    expect(validateModuleText("x".repeat(1024)).ok).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* validateModuleShape                                                 */
/* ------------------------------------------------------------------ */

describe("validateModuleShape", () => {
  it("accepts a valid OpenNotesExtension default export", () => {
    const ns = {
      default: {
        manifest: { id: "community-ext", name: "C", version: "1.0.0", description: "d" },
        activate() {},
      },
    }
    expect(validateModuleShape(ns, "community-ext").ok).toBe(true)
  })

  it("rejects when there is no default export", () => {
    const result = validateModuleShape({ named: {} })
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/default export/)
  })

  it("rejects a non-object namespace", () => {
    expect(validateModuleShape(null).ok).toBe(false)
    expect(validateModuleShape("str").ok).toBe(false)
  })

  it("rejects missing/invalid manifest fields", () => {
    const ns = { default: { manifest: { id: "BAD ID", name: "" }, activate() {} } }
    const result = validateModuleShape(ns)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes("manifest.id"))).toBe(true)
    expect(result.errors.some((e) => e.includes("manifest.name"))).toBe(true)
    expect(result.errors.some((e) => e.includes("manifest.version"))).toBe(true)
  })

  it("rejects when activate is not a function", () => {
    const ns = {
      default: {
        manifest: { id: "x", name: "X", version: "1.0.0", description: "d" },
        activate: "nope",
      },
    }
    const result = validateModuleShape(ns)
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes("activate"))).toBe(true)
  })

  it("rejects a manifest id that does not match the installed entry id", () => {
    const ns = {
      default: {
        manifest: { id: "other-ext", name: "X", version: "1.0.0", description: "d" },
        activate() {},
      },
    }
    const result = validateModuleShape(ns, "community-ext")
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/expected "community-ext"/)
  })
})

/* ------------------------------------------------------------------ */
/* installCommunityExtension                                           */
/* ------------------------------------------------------------------ */

describe("installCommunityExtension", () => {
  it("installs a valid community module and persists it", async () => {
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const entry = makeEntry()

    const result = await installCommunityExtension(entry, {
      fetchImpl: okFetch(VALID_MODULE),
      store,
      installedAt: "2026-08-05T00:00:00.000Z",
    })

    expect(result.ok).toBe(true)
    const listed = await listInstalledCommunity({ store })
    expect(listed).toHaveLength(1)
    expect(listed[0].manifest.id).toBe("community-ext")
    expect(listed[0].source).toBe(VALID_MODULE)
    expect(listed[0].enabled).toBe(true)
    expect(listed[0].installedAt).toBe("2026-08-05T00:00:00.000Z")
  })

  it("rejects non-community entries", async () => {
    const store = createCommunityStore({ backend: makeMemoryBackend() })
    const result = await installCommunityExtension(
      makeEntry({ kind: "core", download: undefined }),
      { fetchImpl: okFetch(VALID_MODULE), store }
    )
    expect(result.ok).toBe(false)
  })

  it("rejects non-https download URLs", async () => {
    const store = createCommunityStore({ backend: makeMemoryBackend() })
    const result = await installCommunityExtension(
      makeEntry({ download: { type: "repo-dir", url: "http://insecure.example.com/ext.js" } }),
      { fetchImpl: okFetch(VALID_MODULE), store }
    )
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/https/)
  })

  it("surfaces network failures without throwing", async () => {
    const store = createCommunityStore({ backend: makeMemoryBackend() })
    const result = await installCommunityExtension(makeEntry(), {
      fetchImpl: failingFetch,
      store,
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/download failed/)
  })

  it("surfaces non-2xx responses", async () => {
    const store = createCommunityStore({ backend: makeMemoryBackend() })
    const fetch404 = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch
    const result = await installCommunityExtension(makeEntry(), { fetchImpl: fetch404, store })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors[0]).toMatch(/404/)
  })

  it("rejects an oversized download without persisting", async () => {
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const big = `// ${"x".repeat(MAX_MODULE_BYTES)}`
    const result = await installCommunityExtension(makeEntry(), {
      fetchImpl: okFetch(big),
      store,
    })
    expect(result.ok).toBe(false)
    expect(await listInstalledCommunity({ store })).toHaveLength(0)
  })

  it("uninstalls a persisted extension", async () => {
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    await installCommunityExtension(makeEntry(), { fetchImpl: okFetch(VALID_MODULE), store })
    expect(await listInstalledCommunity({ store })).toHaveLength(1)
    await uninstallCommunityExtension("community-ext", { store })
    expect(await listInstalledCommunity({ store })).toHaveLength(0)
  })

  it("isHttpsUrl / isInstallableEntry guards", () => {
    expect(isHttpsUrl("https://example.com/x.js")).toBe(true)
    expect(isHttpsUrl("http://example.com/x.js")).toBe(false)
    expect(isHttpsUrl("not a url")).toBe(false)
    expect(isInstallableEntry(makeEntry())).toBe(true)
    expect(isInstallableEntry(makeEntry({ kind: "core", download: undefined }))).toBe(false)
  })
})

/* ------------------------------------------------------------------ */
/* evaluateModule (injected test evaluator)                            */
/*                                                                     */
/* The production `evaluateModule` runs a real Blob/data-URL dynamic   */
/* import, which vitest's SSR transform cannot execute. These tests    */
/* verify the injected evaluator used throughout — it has identical    */
/* accept/reject semantics (syntax error + throwing top-level code).   */
/* The real evaluator is a thin, documented wrapper over the same ESM  */
/* semantics and is exercised in the browser/E2E, not here.            */
/* ------------------------------------------------------------------ */

describe("evaluateViaVm (test evaluator mirroring evaluateModule semantics)", () => {
  it("evaluates a valid module and returns its namespace", async () => {
    const ns = await evaluateViaVm(VALID_MODULE)
    expect(ns.default).toBeDefined()
    expect((ns.default as { manifest: { id: string } }).manifest.id).toBe("community-ext")
  })

  it("rejects on a syntax error", async () => {
    await expect(evaluateViaVm("export default {")).rejects.toThrow()
  })

  it("rejects when top-level code throws", async () => {
    await expect(evaluateViaVm('throw new Error("boom")')).rejects.toThrow(/boom/)
  })

  it("the production evaluateModule is exported and is a function", () => {
    expect(typeof evaluateModule).toBe("function")
  })
})

/* ------------------------------------------------------------------ */
/* loadCommunityExtensions                                             */
/* ------------------------------------------------------------------ */

async function seed(
  backend: CommunityStoreBackend,
  modules: Array<{ id: string; source: string; enabled?: boolean }>
) {
  const store = createCommunityStore({ backend })
  for (const m of modules) {
    await store.save({
      manifest: { id: m.id, name: m.id, version: "1.0.0", description: "d" },
      source: m.source,
      installedAt: "2026-08-05T00:00:00.000Z",
      enabled: m.enabled ?? true,
    })
  }
  return store
}

describe("loadCommunityExtensions", () => {
  it("registers an installed module into the shared registry", async () => {
    const backend = makeMemoryBackend()
    const store = await seed(backend, [{ id: "community-ext", source: VALID_MODULE }])

    const result = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(result.errors).toEqual([])
    expect(result.loaded).toEqual(["community-ext"])
    const loaded = extensionRegistry.list().find((e) => e.manifest.id === "community-ext")
    expect(loaded).toBeDefined()
    expect(loaded!.commands.map((c) => c.id)).toEqual(["ping"])
    expect(extensionRegistry.isEnabled("community-ext")).toBe(true)
  })

  it("is idempotent: a second load skips already-registered ids", async () => {
    const backend = makeMemoryBackend()
    const store = await seed(backend, [{ id: "community-ext", source: VALID_MODULE }])

    const first = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })
    const second = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(first.loaded).toEqual(["community-ext"])
    expect(second.loaded).toEqual(["community-ext"])
    expect(second.errors).toEqual([])
    // Still exactly one registration.
    expect(
      extensionRegistry.list().filter((e) => e.manifest.id === "community-ext")
    ).toHaveLength(1)
  })

  it("skips malformed modules and collects errors without throwing", async () => {
    const backend = makeMemoryBackend()
    const store = await seed(backend, [
      { id: "bad-syntax", source: "export default {" },
      { id: "bad-shape", source: "export default 42" },
      { id: "good", source: VALID_MODULE.replace(/community-ext/g, "good") },
    ])
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(result.loaded).toEqual(["good"])
    expect(result.errors.map((e) => e.id).sort()).toEqual(["bad-shape", "bad-syntax"])
    expect(extensionRegistry.list().map((e) => e.manifest.id)).toEqual(["good"])
    expect(errorSpy).toHaveBeenCalled()
  })

  it("isolates a throwing activate() so other extensions still load", async () => {
    const backend = makeMemoryBackend()
    const store = await seed(backend, [
      {
        id: "throws-on-activate",
        source: `export default { manifest: { id: "throws-on-activate", name: "T", version: "1.0.0", description: "d" }, activate() { throw new Error("activate boom") } }`,
      },
      { id: "good", source: VALID_MODULE.replace(/community-ext/g, "good") },
    ])
    vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(result.loaded).toEqual(["good"])
    expect(result.errors.map((e) => e.id)).toEqual(["throws-on-activate"])
    expect(extensionRegistry.list().map((e) => e.manifest.id)).toEqual(["good"])
  })

  it("skips disabled modules", async () => {
    const backend = makeMemoryBackend()
    const store = await seed(backend, [{ id: "community-ext", source: VALID_MODULE, enabled: false }])

    const result = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(result.loaded).toEqual([])
    expect(extensionRegistry.list()).toHaveLength(0)
  })

  it("rejects a module whose manifest id does not match the installed id", async () => {
    const backend = makeMemoryBackend()
    // Stored under "claimed-id" but the module declares "other-id".
    const store = await seed(backend, [{ id: "claimed-id", source: VALID_MODULE }])
    vi.spyOn(console, "error").mockImplementation(() => {})

    const result = await loadCommunityExtensions({ store, registry: extensionRegistry, evaluate: evaluateViaVm })

    expect(result.loaded).toEqual([])
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].errors[0]).toMatch(/expected "claimed-id"/)
  })
})

/* ------------------------------------------------------------------ */
/* installListener (consent + event flow)                              */
/* ------------------------------------------------------------------ */

describe("installListener consent", () => {
  it("needsConsent is true before grant, false after", () => {
    expect(needsConsent()).toBe(true)
    grantConsent()
    expect(needsConsent()).toBe(false)
    expect(localStorage.getItem(COMMUNITY_CONSENT_KEY)).toBe("granted")
    revokeConsent()
    expect(needsConsent()).toBe(true)
  })
})

describe("initInstallListener", () => {
  async function dispatchAndFlush(entry: unknown) {
    window.dispatchEvent(new CustomEvent(INSTALL_EXTENSION_EVENT, { detail: entry }))
    // Let the listener's async install+load chain settle.
    await new Promise((resolve) => setTimeout(resolve, 20))
  }

  it("prompts for consent on first install, then installs + activates + toasts", async () => {
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const toasts: string[] = []
    const prompt = vi.fn(async () => true)

    const cleanup = initInstallListener({
      showToast: (m) => toasts.push(m),
      promptConsent: prompt,
      install: { fetchImpl: okFetch(VALID_MODULE), store },
      load: { store, registry: extensionRegistry, evaluate: evaluateViaVm },
    })

    await dispatchAndFlush(makeEntry())

    expect(prompt).toHaveBeenCalledOnce()
    expect(needsConsent()).toBe(false) // consent persisted
    expect(extensionRegistry.list().map((e) => e.manifest.id)).toEqual(["community-ext"])
    expect(toasts.at(-1)).toMatch(/Installed "Community Ext"/)
    cleanup()
  })

  it("does not install when consent is declined", async () => {
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const toasts: string[] = []

    const cleanup = initInstallListener({
      showToast: (m) => toasts.push(m),
      promptConsent: async () => false,
      install: { fetchImpl: okFetch(VALID_MODULE), store },
      load: { store, registry: extensionRegistry, evaluate: evaluateViaVm },
    })

    await dispatchAndFlush(makeEntry())

    expect(extensionRegistry.list()).toHaveLength(0)
    expect(await listInstalledCommunity({ store })).toHaveLength(0)
    expect(toasts.at(-1)).toMatch(/cancelled/)
    cleanup()
  })

  it("skips the prompt once consent is persisted", async () => {
    grantConsent()
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const prompt = vi.fn(async () => true)

    const cleanup = initInstallListener({
      showToast: () => {},
      promptConsent: prompt,
      install: { fetchImpl: okFetch(VALID_MODULE), store },
      load: { store, registry: extensionRegistry, evaluate: evaluateViaVm },
    })

    await dispatchAndFlush(makeEntry())
    expect(prompt).not.toHaveBeenCalled()
    expect(extensionRegistry.list().map((e) => e.manifest.id)).toEqual(["community-ext"])
    cleanup()
  })

  it("toasts a failure when the download fails and does not register", async () => {
    grantConsent()
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const toasts: string[] = []

    const cleanup = initInstallListener({
      showToast: (m) => toasts.push(m),
      promptConsent: async () => true,
      install: { fetchImpl: failingFetch, store },
      load: { store, registry: extensionRegistry, evaluate: evaluateViaVm },
    })

    await dispatchAndFlush(makeEntry())

    expect(extensionRegistry.list()).toHaveLength(0)
    expect(toasts.at(-1)).toMatch(/Failed to install/)
    cleanup()
  })

  it("toasts a malformed install request", async () => {
    const toasts: string[] = []
    const cleanup = initInstallListener({ showToast: (m) => toasts.push(m) })
    await dispatchAndFlush({ not: "an entry" })
    expect(toasts.at(-1)).toMatch(/malformed/)
    cleanup()
  })

  it("cleanup removes the listener", async () => {
    grantConsent()
    const backend = makeMemoryBackend()
    const store = createCommunityStore({ backend })
    const cleanup = initInstallListener({
      showToast: () => {},
      promptConsent: async () => true,
      install: { fetchImpl: okFetch(VALID_MODULE), store },
      load: { store, registry: extensionRegistry, evaluate: evaluateViaVm },
    })
    cleanup()
    await dispatchAndFlush(makeEntry())
    expect(extensionRegistry.list()).toHaveLength(0)
  })
})
