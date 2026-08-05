/**
 * Runtime loader for installed community extensions.
 *
 * Reads every persisted + enabled community module from the store,
 * safely evaluates it into an OpenNotesExtension, validates its shape,
 * and registers it with the SAME extensionRegistry used by bundled
 * extensions (core/extensions/registry.ts). From there, the existing
 * enabled-state persistence (core/extensions/store.ts) governs on/off —
 * no core changes.
 *
 * Trust model — TRUSTED-BUT-VERIFIED, NOT A HARDENED SANDBOX:
 * - The module runs as a real ES module in the host realm. It has no
 *   special access to the host: the ONLY surface it is designed to touch
 *   is the OpenNotesExtensionAPI handed to its registered contributions
 *   by the registry. But JavaScript gives it the same globals as any
 *   other in-page code; this loader does not and cannot confine that.
 * - What this layer DOES guarantee: (a) code only ever arrives over
 *   https (enforced at install); (b) the module's default export is
 *   structurally validated as an OpenNotesExtension before registration;
 *   (c) evaluation AND activation are wrapped — a throwing or malformed
 *   module is skipped, logged, and collected into the returned errors[],
 *   and can NEVER crash the host or take down other extensions.
 * - Installing third-party code stays an explicit, consent-gated user
 *   action (see installListener.ts).
 *
 * Module format: single-file, dependency-free ES modules only. The
 * module's default export is the extension. Relative/bare `import`s
 * inside community modules are NOT supported yet (Blob/data-URL modules
 * have no resolution base) — that matches the "small, excellent" ethos;
 * multi-file bundles are a deliberate future extension.
 */

import { extensionRegistry } from "@/core/extensions/registry"
import type { ExtensionRegistry } from "@/core/extensions/registry"
import type { OpenNotesExtension } from "@/core/extensions/types"
import type { CommunityStore, InstalledCommunityModule } from "./communityStore"
import { communityStore as defaultCommunityStore } from "./communityStore"
import { validateModuleShape, validateModuleText } from "./validateModule"

export interface LoadError {
  /** The extension id (manifest id) that failed to load. */
  id: string
  errors: string[]
}

export interface LoadCommunityResult {
  /** Ids successfully registered (or already registered). */
  loaded: string[]
  /** Per-module failures. The loader never throws; failures land here. */
  errors: LoadError[]
}

export interface LoadCommunityOptions {
  /** Persistence. Inject in tests. */
  store?: CommunityStore
  /** Registry. Inject in tests; defaults to the shared singleton. */
  registry?: ExtensionRegistry
  /**
   * Module evaluator. Inject in tests; defaults to `evaluateModule`
   * (real Blob/data-URL ESM import). Test environments that can't run a
   * runtime dynamic import (e.g. vitest's SSR transform) inject an
   * equivalent evaluator.
   */
  evaluate?: (source: string) => Promise<Record<string, unknown>>
}

/**
 * Evaluate module source as a real ES module and return its namespace.
 *
 * Primary path: dynamic import of a Blob URL — a clean, real ESM
 * evaluation with proper module semantics (own scope, strict mode, live
 * bindings). Fallback: a `data:text/javascript` URL, which Node's ESM
 * loader (and therefore vitest) accepts where it rejects `blob:` — same
 * single-file, dependency-free semantics. Either way, evaluation is
 * fully wrapped: ANY failure (syntax error, throwing top-level code,
 * unsupported runtime) rejects the returned promise; callers convert
 * that into a collected error. Never throws synchronously.
 */
export async function evaluateModule(source: string): Promise<Record<string, unknown>> {
  const importSpecifier = (specifier: string): Promise<Record<string, unknown>> =>
    // Indirection keeps bundlers (Next/Turbopack) from trying to analyse
    // or rewrite this dynamic import — the specifier is only known at runtime.
    (new Function("s", "return import(s)") as (s: string) => Promise<Record<string, unknown>>)(
      specifier
    )

  if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    let blobUrl: string | null = null
    try {
      blobUrl = URL.createObjectURL(new Blob([source], { type: "text/javascript" }))
      return await importSpecifier(blobUrl)
    } catch (error) {
      // Some ESM loaders (Node/vitest) can't import blob: URLs — fall
      // through to the data: URL, which has identical single-file,
      // dependency-free semantics.
      void error
    } finally {
      if (blobUrl) {
        try {
          URL.revokeObjectURL(blobUrl)
        } catch {
          // Non-fatal.
        }
      }
    }
  }

  const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`
  try {
    return await importSpecifier(dataUrl)
  } catch (error) {
    throw toError(error)
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** Evaluate + validate one stored module into an OpenNotesExtension. Throws Error with combined messages on failure. */
async function buildExtension(
  stored: InstalledCommunityModule,
  evaluate: (source: string) => Promise<Record<string, unknown>>
): Promise<OpenNotesExtension> {
  const id = stored.manifest.id

  const textResult = validateModuleText(stored.source)
  if (!textResult.ok) {
    throw new Error(textResult.errors.join("; "))
  }

  let namespace: Record<string, unknown>
  try {
    namespace = await evaluate(stored.source)
  } catch (error) {
    throw new Error(`evaluation failed: ${toError(error).message}`)
  }

  // The module may only ever register as the id it was installed under —
  // it cannot impersonate or clobber another extension.
  const shapeResult = validateModuleShape(namespace, id)
  if (!shapeResult.ok) {
    throw new Error(shapeResult.errors.join("; "))
  }

  return namespace.default as OpenNotesExtension
}

/**
 * Load all installed, enabled community extensions into the registry.
 *
 * Idempotent: a module whose id is already registered is skipped, so it
 * is safe to call on app start and again after every install. Malformed
 * or throwing modules are skipped, logged via console.error, and
 * collected — the loader NEVER throws.
 */
export async function loadCommunityExtensions(
  options: LoadCommunityOptions = {}
): Promise<LoadCommunityResult> {
  const store = options.store ?? defaultCommunityStore
  const registry = options.registry ?? extensionRegistry
  const evaluate = options.evaluate ?? evaluateModule

  const result: LoadCommunityResult = { loaded: [], errors: [] }

  let installed: InstalledCommunityModule[]
  try {
    installed = await store.list()
  } catch (error) {
    result.errors.push({
      id: "(store)",
      errors: [`failed to read installed community extensions: ${toError(error).message}`],
    })
    return result
  }

  const registeredIds = new Set(registry.list().map((e) => e.manifest.id))

  for (const stored of installed) {
    const id = stored.manifest.id
    if (!stored.enabled) continue
    if (registeredIds.has(id)) {
      result.loaded.push(id)
      continue
    }

    try {
      const extension = await buildExtension(stored, evaluate)
      try {
        registry.register(extension)
      } catch (registerError) {
        // activate() threw after the registry had already inserted the
        // entry. Roll back so a half-registered extension never lingers.
        try {
          registry.unregister(id)
        } catch {
          // Best effort; the error below still reports the failure.
        }
        throw registerError
      }
      registeredIds.add(id)
      result.loaded.push(id)
    } catch (error) {
      const message = toError(error).message
      // Honest surfacing: a bad community module is loud in the console
      // but silent to everyone else — host and other extensions keep running.
      console.error(`[opennotes] community extension "${id}" failed to load: ${message}`)
      result.errors.push({ id, errors: [message] })
    }
  }

  return result
}
