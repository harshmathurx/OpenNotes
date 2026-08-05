/**
 * In-memory extension registry.
 *
 * Holds activated extensions, their commands and slash items, and the
 * runtime enabled/disabled state. The registry is the single source of
 * truth for the hook and the management modal; it notifies subscribers
 * on any change so React can re-render.
 *
 * Design notes:
 * - Commands and slash items are only exposed from ENABLED extensions.
 * - Enable/disable persists via core/extensions/store.ts.
 * - Everything is sync-safe: registration and lookups are plain map
 *   operations; command execution may be async but the registry never
 *   blocks on it.
 */

import type {
  ExtensionCommand,
  ExtensionPanel,
  ExtensionSlashItem,
  LoadedExtension,
  OpenNotesExtension,
} from "./types"
import { loadEnabledState, persistEnabled } from "./store"

interface RegistryEntry {
  extension: OpenNotesExtension
  commands: Map<string, ExtensionCommand>
  slashItems: Map<string, ExtensionSlashItem>
  panels: Map<string, ExtensionPanel>
  enabled: boolean
}

type Listener = () => void

function commandKey(extensionId: string, commandId: string): string {
  return `${extensionId}:${commandId}`
}

class ExtensionRegistry {
  private entries = new Map<string, RegistryEntry>()
  private listeners = new Set<Listener>()
  /**
   * Cached snapshot of `list()` for useSyncExternalStore. React requires
   * `getSnapshot`/`getServerSnapshot` to return a referentially stable value
   * between notifications, otherwise it re-renders in an infinite loop.
   * Rebuilt lazily whenever `version` bumps.
   */
  private version = 0
  private cachedList: LoadedExtension[] = []
  private cachedVersion = -1

  /**
   * Activate and register an extension. If an extension with the same id
   * is already registered it is replaced (re-activation is supported).
   * Enabled state defaults to true unless persisted otherwise.
   */
  register(extension: OpenNotesExtension): LoadedExtension {
    const { manifest } = extension
    if (!manifest?.id) {
      throw new Error("Extension manifest must have an id")
    }

    const entry: RegistryEntry = {
      extension,
      commands: new Map(),
      slashItems: new Map(),
      panels: new Map(),
      enabled: this.resolveInitialEnabled(manifest.id, manifest.defaultEnabled),
    }
    this.entries.set(manifest.id, entry)

    extension.activate({
      registerCommand: (cmd) => {
        entry.commands.set(cmd.id, cmd)
      },
      registerSlashItem: (item) => {
        entry.slashItems.set(item.id, item)
      },
      registerPanel: (panel) => {
        entry.panels.set(panel.id, panel)
      },
    })

    this.notify()
    return this.toLoaded(entry)
  }

  /** Remove an extension and all of its contributions. */
  unregister(extensionId: string): void {
    if (this.entries.delete(extensionId)) {
      this.notify()
    }
  }

  /** All registered extensions (enabled and disabled) as LoadedExtension snapshots. Referentially stable between changes. */
  list(): LoadedExtension[] {
    if (this.cachedVersion !== this.version) {
      this.cachedList = Array.from(this.entries.values()).map((entry) =>
        this.toLoaded(entry)
      )
      this.cachedVersion = this.version
    }
    return this.cachedList
  }

  isEnabled(extensionId: string): boolean {
    return this.entries.get(extensionId)?.enabled ?? false
  }

  setEnabled(extensionId: string, enabled: boolean): void {
    const entry = this.entries.get(extensionId)
    if (!entry || entry.enabled === enabled) return
    entry.enabled = enabled
    persistEnabled(extensionId, enabled)
    this.notify()
  }

  /** Commands from ENABLED extensions only, keyed as `${extensionId}:${commandId}`. */
  getCommands(): Array<{ key: string; extensionId: string; command: ExtensionCommand }> {
    const out: Array<{ key: string; extensionId: string; command: ExtensionCommand }> = []
    for (const entry of this.entries.values()) {
      if (!entry.enabled) continue
      for (const command of entry.commands.values()) {
        out.push({
          key: commandKey(entry.extension.manifest.id, command.id),
          extensionId: entry.extension.manifest.id,
          command,
        })
      }
    }
    return out
  }

  /** Slash items from ENABLED extensions only, keyed as `${extensionId}:${itemId}`. */
  getSlashItems(): Array<{ key: string; extensionId: string; item: ExtensionSlashItem }> {
    const out: Array<{ key: string; extensionId: string; item: ExtensionSlashItem }> = []
    for (const entry of this.entries.values()) {
      if (!entry.enabled) continue
      for (const item of entry.slashItems.values()) {
        out.push({
          key: commandKey(entry.extension.manifest.id, item.id),
          extensionId: entry.extension.manifest.id,
          item,
        })
      }
    }
    return out
  }

  /** Look up a single command by `${extensionId}:${commandId}`. Disabled extensions return null. */
  getCommand(key: string): { extensionId: string; command: ExtensionCommand } | null {
    const [extensionId, commandId] = splitKey(key)
    if (!extensionId || !commandId) return null
    const entry = this.entries.get(extensionId)
    if (!entry || !entry.enabled) return null
    const command = entry.commands.get(commandId)
    return command ? { extensionId, command } : null
  }

  /** Look up a single slash item by `${extensionId}:${itemId}`. Disabled extensions return null. */
  getSlashItem(key: string): { extensionId: string; item: ExtensionSlashItem } | null {
    const [extensionId, itemId] = splitKey(key)
    if (!extensionId || !itemId) return null
    const entry = this.entries.get(extensionId)
    if (!entry || !entry.enabled) return null
    const item = entry.slashItems.get(itemId)
    return item ? { extensionId, item } : null
  }

  /** Panels from ENABLED extensions only, keyed as `${extensionId}:${panelId}`. */
  getPanels(): Array<{ key: string; extensionId: string; panel: ExtensionPanel }> {
    const out: Array<{ key: string; extensionId: string; panel: ExtensionPanel }> = []
    for (const entry of this.entries.values()) {
      if (!entry.enabled) continue
      for (const panel of entry.panels.values()) {
        out.push({
          key: commandKey(entry.extension.manifest.id, panel.id),
          extensionId: entry.extension.manifest.id,
          panel,
        })
      }
    }
    return out
  }

  /** Look up a single panel by `${extensionId}:${panelId}`. Disabled extensions return null. */
  getPanel(key: string): { extensionId: string; panel: ExtensionPanel } | null {
    const [extensionId, panelId] = splitKey(key)
    if (!extensionId || !panelId) return null
    const entry = this.entries.get(extensionId)
    if (!entry || !entry.enabled) return null
    const panel = entry.panels.get(panelId)
    return panel ? { extensionId, panel } : null
  }

  /** Subscribe to registry changes (register/unregister/enable/disable). Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Remove all extensions and listeners. Intended for tests. */
  reset(): void {
    this.entries.clear()
    this.notify()
  }

  private resolveInitialEnabled(extensionId: string, defaultEnabled?: boolean): boolean {
    const persisted = loadEnabledState()
    return persisted[extensionId] ?? defaultEnabled ?? true
  }

  private toLoaded(entry: RegistryEntry): LoadedExtension {
    return {
      manifest: entry.extension.manifest,
      commands: Array.from(entry.commands.values()),
      slashItems: Array.from(entry.slashItems.values()),
      panels: Array.from(entry.panels.values()),
      enabled: entry.enabled,
    }
  }

  private notify(): void {
    this.version++
    for (const listener of this.listeners) {
      listener()
    }
  }
}

function splitKey(key: string): [string | null, string | null] {
  const idx = key.indexOf(":")
  if (idx <= 0 || idx === key.length - 1) return [null, null]
  return [key.slice(0, idx), key.slice(idx + 1)]
}

/** Shared singleton registry used by the app, the hook, and the modal. */
export const extensionRegistry = new ExtensionRegistry()

export type { ExtensionRegistry }
