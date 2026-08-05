/**
 * Validation of a downloaded community extension module.
 *
 * A community extension is a single, dependency-free ES module whose
 * DEFAULT export is an OpenNotesExtension-shaped object:
 *
 *   export default {
 *     manifest: { id, name, version, description, ... },
 *     activate(ctx) { ctx.registerCommand(...); ... },
 *   }
 *
 * `validateModuleText` runs on the raw source BEFORE evaluation (cheap
 * rejects: empty, oversized); `validateModuleShape` runs on the evaluated
 * module namespace AFTER import (structural contract check). Both are
 * pure, never throw, never mutate input, and collect every problem they
 * find — mirroring core/registry/schema.ts.
 *
 * Trust model: this is "trusted-but-verified" loading, NOT a hardened
 * sandbox. Validation guarantees the module is structurally an
 * OpenNotesExtension so a malformed artifact can't crash the host; it
 * does NOT make malicious code safe. Install remains an explicit,
 * consent-gated user action (see installListener.ts).
 */

import type { ExtensionManifest, OpenNotesExtension } from "@/core/extensions/types"

/** Hard size cap for a community module. Keeps installs small, excellent, and reviewable. */
export const MAX_MODULE_BYTES = 256 * 1024

export interface ModuleValidationResult {
  ok: boolean
  errors: string[]
}

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Validate raw module source text before it is fetched-persisted or
 * evaluated. Rejects empty/oversized sources. Never throws.
 */
export function validateModuleText(text: unknown): ModuleValidationResult {
  const errors: string[] = []

  if (typeof text !== "string" || text.trim().length === 0) {
    errors.push("module source must be a non-empty string")
    return { ok: false, errors }
  }

  // Byte length, not char length — the cap is about payload size.
  if (new TextEncoder().encode(text).length > MAX_MODULE_BYTES) {
    errors.push(`module source exceeds the ${MAX_MODULE_BYTES}-byte limit`)
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Validate an evaluated module namespace: it must have a default export
 * that is an OpenNotesExtension — a manifest with id/name/version (plus
 * description) and an activate function. When `expectedId` is given (the
 * registry entry id), the manifest id must match it: an extension may
 * only ever register as the id it was installed under, so it cannot
 * impersonate or clobber another extension. Never throws.
 */
export function validateModuleShape(
  moduleNamespace: unknown,
  expectedId?: string
): ModuleValidationResult {
  const errors: string[] = []

  if (!isRecord(moduleNamespace)) {
    return { ok: false, errors: ["module did not evaluate to an object namespace"] }
  }

  const candidate: unknown = moduleNamespace.default
  if (!isRecord(candidate)) {
    return {
      ok: false,
      errors: ["module must have a default export that is an OpenNotesExtension object"],
    }
  }

  const manifest: unknown = candidate.manifest
  if (!isRecord(manifest)) {
    errors.push("default export must carry a manifest object")
  } else {
    if (!isNonEmptyString(manifest.id)) {
      errors.push("manifest.id: required (non-empty string)")
    } else if (!KEBAB_CASE.test(manifest.id)) {
      errors.push(`manifest.id: must be kebab-case, got "${manifest.id}"`)
    } else if (expectedId !== undefined && manifest.id !== expectedId) {
      errors.push(`manifest.id: expected "${expectedId}" (the registry entry id), got "${manifest.id}"`)
    }
    if (!isNonEmptyString(manifest.name)) errors.push("manifest.name: required (non-empty string)")
    if (!isNonEmptyString(manifest.version)) {
      errors.push("manifest.version: required (non-empty string)")
    }
    if (!isNonEmptyString(manifest.description)) {
      errors.push("manifest.description: required (non-empty string)")
    }
    if (manifest.author !== undefined && !isNonEmptyString(manifest.author)) {
      errors.push("manifest.author: must be a non-empty string when present")
    }
    if (manifest.defaultEnabled !== undefined && typeof manifest.defaultEnabled !== "boolean") {
      errors.push("manifest.defaultEnabled: must be a boolean when present")
    }
  }

  if (typeof candidate.activate !== "function") {
    errors.push("default export must have an activate(ctx) function")
  }

  return { ok: errors.length === 0, errors }
}

/**
 * Narrow an unknown value to OpenNotesExtension after
 * `validateModuleShape` passed. Returns null otherwise — callers should
 * prefer validating first and using the errors for reporting.
 */
export function asOpenNotesExtension(value: unknown): OpenNotesExtension | null {
  const probe = { default: value }
  if (!validateModuleShape(probe).ok) return null
  return value as OpenNotesExtension
}

export type { ExtensionManifest }
