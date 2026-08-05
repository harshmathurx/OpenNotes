"use client"

/**
 * React binding for the extensions system.
 *
 * Loads bundled samples (once), subscribes to the registry so the UI
 * updates on enable/disable, and exposes a flat surface for integrators:
 * command palette entries, slash-menu items, and the management modal.
 *
 * Works with NO host wiring: without injected handlers the API degrades
 * gracefully (getActiveNote → null, commands toast "No active note").
 * The integrator passes real handlers to wire Tiptap/editor/toasts.
 */

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { extensionRegistry } from "@/core/extensions/registry"
import { loadBundledExtensions } from "@/core/extensions/loader"
import { buildAPI, type ExtensionAPIContext } from "@/core/extensions/api"
import type {
  ExtensionCommand,
  ExtensionPanel,
  ExtensionSlashItem,
  LoadedExtension,
} from "@/core/extensions/types"

/** Stable empty snapshot for the server-render pass of useSyncExternalStore. */
const EMPTY_EXTENSIONS: LoadedExtension[] = []

export interface ExtensionCommandEntry {
  /** `${extensionId}:${commandId}` — pass to runCommand. */
  id: string
  extensionId: string
  title: string
}

export interface ExtensionSlashItemEntry {
  /** `${extensionId}:${itemId}` */
  id: string
  extensionId: string
  title: string
  description?: string
}

export interface ExtensionPanelEntry {
  /** `${extensionId}:${panelId}` */
  id: string
  extensionId: string
  title: string
  icon?: string
  side: "left" | "right"
  component: ExtensionPanel["component"]
}

export interface UseExtensionsOptions {
  getActiveNote?: ExtensionAPIContext["getActiveNote"]
  getNotes?: ExtensionAPIContext["getNotes"]
  openNote?: ExtensionAPIContext["openNote"]
  createNote?: ExtensionAPIContext["createNote"]
  getSelection?: ExtensionAPIContext["getSelection"]
  replaceSelection?: ExtensionAPIContext["replaceSelection"]
  insertIntoActiveNote?: ExtensionAPIContext["insertIntoActiveNote"]
  setActiveNoteContent?: ExtensionAPIContext["setActiveNoteContent"]
  showToast?: ExtensionAPIContext["showToast"]
  ai?: ExtensionAPIContext["ai"]
}

export interface UseExtensionsResult {
  /** All registered extensions with enabled state (for the management modal). */
  extensions: LoadedExtension[]
  /** Commands from enabled extensions, ready for the command palette. */
  commands: ExtensionCommandEntry[]
  /** Slash items from enabled extensions, ready for the editor slash menu. */
  slashItems: ExtensionSlashItemEntry[]
  /** Panels from enabled extensions, ready to dock. */
  panels: ExtensionPanelEntry[]
  isEnabled: (extensionId: string) => boolean
  setEnabled: (extensionId: string, enabled: boolean) => void
  /** Run a command by its registry key (`${extensionId}:${commandId}`). */
  runCommand: (id: string) => Promise<void>
  /** Resolve a slash item's markdown by its registry key. */
  getSlashItemMarkdown: (id: string) => Promise<string | null>
  /** Build the live API instance for a given extension (used by panel hosts). */
  getAPI: (extensionId: string) => ReturnType<typeof buildAPI>
  /** True once bundled extensions have been loaded. */
  ready: boolean
}

export function useExtensions(options: UseExtensionsOptions = {}): UseExtensionsResult {
  const {
    getActiveNote,
    getNotes,
    openNote,
    createNote,
    getSelection,
    replaceSelection,
    insertIntoActiveNote,
    setActiveNoteContent,
    showToast,
    ai,
  } = options

  useEffect(() => {
    loadBundledExtensions()
  }, [])

  // Re-render whenever the registry changes (register/enable/disable).
  // The registry's list() is referentially stable between notifications,
  // which is what useSyncExternalStore requires to avoid infinite loops.
  const snapshot = useSyncExternalStore(
    useCallback((onChange) => extensionRegistry.subscribe(onChange), []),
    () => extensionRegistry.list(),
    () => EMPTY_EXTENSIONS
  )

  const extensions = useMemo(() => snapshot, [snapshot])

  const commands = useMemo<ExtensionCommandEntry[]>(() => {
    void snapshot // re-derive whenever the registry snapshot changes
    return extensionRegistry.getCommands().map(({ key, extensionId, command }) => ({
      id: key,
      extensionId,
      title: command.title,
    }))
  }, [snapshot])

  const slashItems = useMemo<ExtensionSlashItemEntry[]>(() => {
    void snapshot // re-derive whenever the registry snapshot changes
    return extensionRegistry.getSlashItems().map(({ key, extensionId, item }) => ({
      id: key,
      extensionId,
      title: item.title,
      description: item.description,
    }))
  }, [snapshot])

  const panels = useMemo<ExtensionPanelEntry[]>(() => {
    void snapshot // re-derive whenever the registry snapshot changes
    return extensionRegistry.getPanels().map(({ key, extensionId, panel }) => ({
      id: key,
      extensionId,
      title: panel.title,
      icon: panel.icon,
      side: panel.side ?? "right",
      component: panel.component,
    }))
  }, [snapshot])

  const apiFor = useCallback(
    (extensionId: string) =>
      buildAPI({
        extensionId,
        getActiveNote,
        getNotes,
        openNote,
        createNote,
        getSelection,
        replaceSelection,
        insertIntoActiveNote,
        setActiveNoteContent,
        showToast,
        ai,
      }),
    [
      getActiveNote,
      getNotes,
      openNote,
      createNote,
      getSelection,
      replaceSelection,
      insertIntoActiveNote,
      setActiveNoteContent,
      showToast,
      ai,
    ]
  )

  const isEnabled = useCallback(
    (extensionId: string) => extensionRegistry.isEnabled(extensionId),
    []
  )

  const setEnabled = useCallback((extensionId: string, enabled: boolean) => {
    extensionRegistry.setEnabled(extensionId, enabled)
  }, [])

  const runCommand = useCallback(
    async (id: string) => {
      const found = extensionRegistry.getCommand(id)
      if (!found) return
      const command: ExtensionCommand = found.command
      await command.run(apiFor(found.extensionId))
    },
    [apiFor]
  )

  const getSlashItemMarkdown = useCallback(
    async (id: string) => {
      const found = extensionRegistry.getSlashItem(id)
      if (!found) return null
      const item: ExtensionSlashItem = found.item
      return item.insert(apiFor(found.extensionId))
    },
    [apiFor]
  )

  return {
    extensions,
    commands,
    slashItems,
    panels,
    isEnabled,
    setEnabled,
    runCommand,
    getSlashItemMarkdown,
    getAPI: apiFor,
    ready: true,
  }
}
