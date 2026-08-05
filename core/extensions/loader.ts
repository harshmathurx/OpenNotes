/**
 * Bundled-sample loader.
 *
 * Statically imports the sample extensions shipped with the app,
 * registers them with the registry (applying persisted enabled state),
 * and returns the resulting LoadedExtension snapshots.
 *
 * A future disk-based loader (Mac app reading an `extensions/` folder)
 * will slot in beside this: validate each on-disk manifest, wrap the
 * module in the OpenNotesExtension contract, and pass it to the same
 * registry — see the header in core/extensions/types.ts.
 */

import { extensionRegistry } from "./registry"
import type { LoadedExtension } from "./types"
import { gitSyncExtension } from "@/extensions/gitSync"
import { templatesExtension } from "@/extensions/templates"
import { exportExtension } from "@/extensions/export"
import { backlinksExtension } from "@/extensions/backlinks"
import { aiCowriterExtension } from "@/extensions/aiCowriter"

const BUNDLED_EXTENSIONS = [
  gitSyncExtension,
  templatesExtension,
  exportExtension,
  backlinksExtension,
  aiCowriterExtension,
]

let loaded = false

/**
 * Register all bundled samples. Idempotent: subsequent calls are no-ops,
 * so it is safe to invoke from React effects and module init paths.
 */
export function loadBundledExtensions(): LoadedExtension[] {
  if (!loaded) {
    loaded = true
    for (const extension of BUNDLED_EXTENSIONS) {
      // Skip re-registration if already present (e.g. tests pre-registered).
      if (extensionRegistry.list().some((e) => e.manifest.id === extension.manifest.id)) {
        continue
      }
      extensionRegistry.register(extension)
    }
  }
  return extensionRegistry.list()
}

/** Test hook: allow re-running the loader after a registry reset. */
export function resetLoaderForTests(): void {
  loaded = false
}
