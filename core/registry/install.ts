/**
 * Install / uninstall of community extensions from the registry.
 *
 * `installCommunityExtension` downloads the extension's single-file ES
 * module from its registry `download.url`, validates the source, and
 * persists it via the community store. It does NOT evaluate or register
 * anything — that is communityLoader.ts's job. This keeps install a
 * pure-ish, fully testable step: inject `fetchImpl` and `store` in tests.
 *
 * Security posture (trusted-but-verified, NOT a hardened sandbox):
 * - Modules are only ever fetched over https://.
 * - The entry must be kind "community" with a download URL.
 * - Source is validated (non-empty, <= 256KB) before it is persisted.
 * - Nothing here runs the code. Evaluation happens later, wrapped, in
 *   communityLoader.ts, and the only surface the extension touches is
 *   the OpenNotesExtensionAPI handed to its registered contributions.
 */

import type { CommunityStore } from "./communityStore"
import { communityStore as defaultCommunityStore } from "./communityStore"
import type { InstalledCommunityModule } from "./communityStore"
import type { RegistryEntry } from "./types"
import { validateModuleText } from "./validateModule"

export const DEFAULT_INSTALL_TIMEOUT_MS = 10_000

export type InstallResult =
  | { ok: true; module: InstalledCommunityModule }
  | { ok: false; errors: string[] }

export interface InstallCommunityExtensionOptions {
  /** Fetch implementation. Inject a stub in tests; defaults to global fetch. */
  fetchImpl?: typeof fetch
  /** Persistence. Inject in tests; defaults to the shared localStorage-backed store. */
  store?: CommunityStore
  /** Hard timeout for the download in ms. */
  timeoutMs?: number
  /** Override the install timestamp (tests). Defaults to now. */
  installedAt?: string
}

/** True when the entry is installable: kind "community" with a download URL. */
export function isInstallableEntry(entry: RegistryEntry): boolean {
  return entry.kind === "community" && typeof entry.download?.url === "string"
}

/**
 * True only for https:// URLs. Community modules are never loaded over
 * plain http — a network attacker must not be able to substitute code.
 * (Non-URL / relative input also returns false.)
 */
export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

/**
 * Download, validate, and persist a community extension module.
 * Never throws — every failure mode (bad entry, non-https URL, network
 * error, non-2xx, oversized/empty source) resolves to `{ ok: false, errors }`.
 */
export async function installCommunityExtension(
  entry: RegistryEntry,
  options: InstallCommunityExtensionOptions = {}
): Promise<InstallResult> {
  const {
    fetchImpl,
    store = defaultCommunityStore,
    timeoutMs = DEFAULT_INSTALL_TIMEOUT_MS,
    installedAt = new Date().toISOString(),
  } = options

  if (!isInstallableEntry(entry)) {
    return {
      ok: false,
      errors: [`entry "${entry.id}" is not an installable community extension (needs kind "community" + download.url)`],
    }
  }

  const url = entry.download!.url
  if (!isHttpsUrl(url)) {
    return { ok: false, errors: [`download.url must be an https:// URL, got "${url}"`] }
  }

  const impl =
    fetchImpl ??
    (typeof fetch === "function" ? (fetch.bind(globalThis) as typeof fetch) : undefined)
  if (!impl) {
    return { ok: false, errors: ["no fetch implementation available in this runtime"] }
  }

  let source: string
  try {
    let signal: AbortSignal | undefined
    try {
      if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
        signal = AbortSignal.timeout(timeoutMs)
      }
    } catch {
      // The race below still enforces the deadline.
    }
    const response = await Promise.race([
      impl(url, { signal }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`download timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ])
    if (!response.ok) {
      return { ok: false, errors: [`download failed with status ${response.status}`] }
    }
    source = await response.text()
  } catch (error) {
    return {
      ok: false,
      errors: [`download failed: ${error instanceof Error ? error.message : String(error)}`],
    }
  }

  const textResult = validateModuleText(source)
  if (!textResult.ok) {
    return { ok: false, errors: textResult.errors }
  }

  const installedModule: InstalledCommunityModule = {
    manifest: {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      description: entry.description,
      author: entry.author,
    },
    source,
    installedAt,
    enabled: true,
  }
  await store.save(installedModule)
  return { ok: true, module: installedModule }
}

/** Remove a persisted community extension. Never throws. */
export async function uninstallCommunityExtension(
  id: string,
  options: { store?: CommunityStore } = {}
): Promise<void> {
  const store = options.store ?? defaultCommunityStore
  await store.remove(id)
}

/** Every persisted community extension (installed modules, valid or not yet evaluated). Never throws. */
export async function listInstalledCommunity(
  options: { store?: CommunityStore } = {}
): Promise<InstalledCommunityModule[]> {
  const store = options.store ?? defaultCommunityStore
  return store.list()
}
