/**
 * Browse-UI install bridge (Mac app).
 *
 * The registry Browse UI dispatches a window event
 * `opennotes:install-extension` whose `detail` is a RegistryEntry.
 * `initInstallListener` listens for it, gates the FIRST install on
 * explicit user consent, installs the module (install.ts), then loads
 * it into the live registry (communityLoader.ts) so it activates
 * immediately. Results are toasted via an injected `showToast`. Returns
 * a cleanup function that removes the listener.
 *
 * Consent & trust model — be honest about this:
 * A community extension is third-party JavaScript that runs in the host
 * realm. Loading is "trusted-but-verified" (https-only, shape-validated,
 * failure-isolated), NOT a hardened sandbox. So the FIRST install
 * requires an explicit opt-in, persisted under the storage key
 * "opennotes-community-consent". `grantConsent` is only called after the
 * host shows the user a real prompt and they accept; the listener never
 * grants it on its own. Wire `promptConsent` to a confirmation dialog on
 * the Mac app; it defaults to a conservative `confirm()` (or "no" where
 * `confirm` doesn't exist, e.g. tests/SSR).
 */

import { loadCommunityExtensions } from "./communityLoader"
import type { LoadCommunityOptions } from "./communityLoader"
import { installCommunityExtension } from "./install"
import type { InstallCommunityExtensionOptions } from "./install"
import type { RegistryEntry } from "./types"

export const INSTALL_EXTENSION_EVENT = "opennotes:install-extension"
export const COMMUNITY_CONSENT_KEY = "opennotes-community-consent"

type ShowToast = (message: string) => void

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage
    if (typeof localStorage !== "undefined") return localStorage
    return null
  } catch {
    return null
  }
}

/** True once the user has explicitly opted in to community extensions. Never throws. */
export function needsConsent(): boolean {
  try {
    return safeLocalStorage()?.getItem(COMMUNITY_CONSENT_KEY) !== "granted"
  } catch {
    return true
  }
}

/** Persist the user's opt-in. Called by the host ONLY after a real prompt is accepted. */
export function grantConsent(): void {
  try {
    safeLocalStorage()?.setItem(COMMUNITY_CONSENT_KEY, "granted")
  } catch {
    // Storage unavailable — consent simply won't persist; the next install re-asks.
  }
}

/** Clear the persisted opt-in (e.g. a "reset community extensions" setting). */
export function revokeConsent(): void {
  try {
    safeLocalStorage()?.removeItem(COMMUNITY_CONSENT_KEY)
  } catch {
    // Non-fatal.
  }
}

function defaultShowToast(message: string): void {
  // Degrade-safe default: no toast host wired, so log instead of crashing.
  console.log(`[opennotes] ${message}`)
}

async function defaultPromptConsent(entry: RegistryEntry): Promise<boolean> {
  try {
    if (typeof confirm === "function") {
      return confirm(
        `Install the community extension "${entry.name}" by ${entry.author}?\n\n` +
          "Community extensions are third-party code. OpenNotes verifies their shape and loads " +
          "them over https, but this is not a hardened sandbox — only install extensions you trust."
      )
    }
  } catch {
    // Fall through to the conservative default.
  }
  return false
}

function isRegistryEntry(value: unknown): value is RegistryEntry {
  if (typeof value !== "object" || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.version === "string" &&
    (record.kind === "core" || record.kind === "community")
  )
}

export interface InitInstallListenerOptions {
  /** Toast sink. Inject the app's toast in the host; inject a spy in tests. */
  showToast?: ShowToast
  /**
   * Consent prompt. Called on the first install (when needsConsent()).
   * Resolve true to grant + persist consent and proceed. Defaults to a
   * conservative confirm(); wire a proper dialog on the Mac app.
   */
  promptConsent?: (entry: RegistryEntry) => Promise<boolean>
  /** Passed through to installCommunityExtension (inject fetch/store in tests). */
  install?: InstallCommunityExtensionOptions
  /** Passed through to loadCommunityExtensions (inject store/registry in tests). */
  load?: LoadCommunityOptions
}

/**
 * Start listening for registry install events. Returns a cleanup
 * function that removes the listener. Safe to call in the browser only;
 * in SSR it returns a no-op cleanup.
 */
export function initInstallListener(options: InitInstallListenerOptions = {}): () => void {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {}
  }

  const showToast = options.showToast ?? defaultShowToast
  const promptConsent = options.promptConsent ?? defaultPromptConsent

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail
    if (!isRegistryEntry(detail)) {
      showToast("Could not install extension: malformed install request.")
      return
    }
    const entry = detail

    // Fire-and-forget with a top-level catch: an install must never
    // produce an unhandled rejection in the host.
    void (async () => {
      try {
        if (needsConsent()) {
          const granted = await promptConsent(entry)
          if (!granted) {
            showToast(`Install of "${entry.name}" cancelled.`)
            return
          }
          grantConsent()
        }

        const installed = await installCommunityExtension(entry, options.install)
        if (!installed.ok) {
          showToast(`Failed to install "${entry.name}": ${installed.errors.join("; ")}`)
          return
        }

        const loaded = await loadCommunityExtensions(options.load)
        const loadError = loaded.errors.find((e) => e.id === entry.id)
        if (loadError) {
          showToast(`Installed "${entry.name}" but it failed to activate: ${loadError.errors.join("; ")}`)
          return
        }
        showToast(`Installed "${entry.name}".`)
      } catch (error) {
        showToast(
          `Failed to install "${entry.name}": ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })()
  }

  window.addEventListener(INSTALL_EXTENSION_EVENT, handler)
  return () => {
    window.removeEventListener(INSTALL_EXTENSION_EVENT, handler)
  }
}
