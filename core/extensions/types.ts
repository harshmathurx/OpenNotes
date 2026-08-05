/**
 * OpenNotes Extensions — the public contract.
 *
 * Product direction: open-source, local-first, community-extensible.
 * This file is THE extension API surface. Keep it tight, documented,
 * and stable — community extensions will be written against it.
 *
 * How extensions work (MVP):
 * - An extension is a plain object: a {@link ExtensionManifest} plus an
 *   `activate(ctx)` function. `activate` registers commands and slash
 *   items through the provided context. No eval, no remote code —
 *   bundled samples are statically imported and compiled with the app.
 * - The runtime registry (core/extensions/registry.ts) holds activated
 *   extensions in memory and tracks enabled/disabled state, persisted
 *   to localStorage (core/extensions/store.ts).
 * - Each command/slash item receives an {@link OpenNotesExtensionAPI}
 *   instance, built per extension by core/extensions/api.ts. The host
 *   app injects real implementations (active note, editor insertion,
 *   toasts); without host wiring everything degrades gracefully.
 *
 * Future disk-based loader (Mac app):
 * - The desktop app will read an `extensions/` folder from disk, where
 *   each entry is a folder with `manifest.json` (matching
 *   {@link ExtensionManifest}) and a sandboxed entry module.
 * - The loader will validate the manifest, wrap the module in the same
 *   activate() contract below, and hand the resulting
 *   {@link OpenNotesExtension} to the same registry — no changes to
 *   registry/store/api needed. Sandboxing (isolated realm, capability
 *   allowlist) is the Mac app's responsibility; this contract stays
 *   identical for bundled and disk-loaded extensions.
 */

/** Static metadata describing an extension. */
export interface ExtensionManifest {
  /** Unique, stable id (e.g. "word-goals"). Used for storage namespacing and enable/disable persistence. */
  id: string
  /** Human-readable name shown in the Extensions modal. */
  name: string
  /** Semantic version string. */
  version: string
  /** One-line description shown in the Extensions modal. */
  description: string
  /** Optional author attribution. */
  author?: string
  /**
   * Whether the extension is enabled the first time it is registered
   * (before any persisted preference). Defaults to `true`. Core-shipped
   * but opt-in experiences (e.g. the AI Co-Writer) set this to `false`
   * so the app stays minimal until the user turns them on.
   */
  defaultEnabled?: boolean
}

/**
 * A command surfaced in the command palette.
 * `run` receives the extension's API instance; it may be async.
 */
export interface ExtensionCommand {
  /** Unique within the extension. Registry keys commands as `${extensionId}:${id}`. */
  id: string
  /** Title shown in the command palette. */
  title: string
  run(api: OpenNotesExtensionAPI): void | Promise<void>
}

/**
 * An item surfaced in the editor's slash menu.
 * `insert` returns the markdown string to insert at the cursor.
 */
export interface ExtensionSlashItem {
  /** Unique within the extension. Registry keys items as `${extensionId}:${id}`. */
  id: string
  /** Title shown in the slash menu. */
  title: string
  /** Optional subtitle shown in the slash menu. */
  description?: string
  insert(api: OpenNotesExtensionAPI): string | Promise<string>
}

/**
 * A dockable panel contributed by an extension (e.g. a source-control
 * sidebar, a backlinks pane, an AI co-writer). The host renders one
 * active panel at a time in a side region. `component` is a React
 * component the host mounts when the panel is shown; it receives the
 * extension's API instance as a prop.
 */
export interface ExtensionPanel {
  /** Unique within the extension. Registry keys panels as `${extensionId}:${id}`. */
  id: string
  /** Title shown in the panel header and activity affordances. */
  title: string
  /** Icon name (lucide) used in the panel switcher. Resolved by the host. */
  icon?: string
  /** Where the panel docks. Defaults to "right". */
  side?: "left" | "right"
  /**
   * The React component to render. Declared as `unknown` here to keep
   * this contract framework-light; the host casts it to a React
   * component receiving `{ api: OpenNotesExtensionAPI }`.
   */
  component: unknown
}

/**
 * The surface an extension is allowed to touch.
 * Built per-extension by `buildAPI(context)`; `storage` is namespaced
 * by the extension's manifest id so extensions cannot collide.
 */
export interface OpenNotesExtensionAPI {
  /** The currently open note, or null when the host has no active note. Extensions must handle null. */
  getActiveNote(): { path: string; content: string } | null
  /** All notes in the workspace (path + content). Empty array when the host has none. */
  getNotes(): Array<{ path: string; content: string }>
  /** Open a note by path in the editor. No-op when the host cannot navigate. */
  openNote(path: string): void
  /** Create a new note and open it. Returns the created path, or null when unsupported. */
  createNote?(name?: string): Promise<string | null>
  /** The current text selection in the editor, or "" when there is none / unsupported. */
  getSelection?(): string
  /** Replace the current editor selection with markdown. No-op when unsupported. */
  replaceSelection?(markdown: string): void
  /** Insert markdown into the active note at the cursor. No-op when there is no active note. */
  insertIntoActiveNote(markdown: string): void
  /** Overwrite the entire content of the active note. No-op when unsupported. */
  setActiveNoteContent?(markdown: string): void
  /** Show a short, non-blocking toast message to the user. */
  showToast(message: string): void
  /**
   * Optional bridge to the app's AI co-writer. Only present when the host
   * has an AI provider configured. Extensions call this to run a prompt and
   * receive streamed text; it resolves to the full generated string. Rejects
   * with an Error when AI is unavailable. Extensions must handle absence.
   */
  ai?: {
    available(): boolean
    complete(prompt: string, options?: { system?: string }): Promise<string>
  }
  /** Per-extension key/value storage (namespaced by extension id). Values are strings; plain JSON-serializable data only — no secrets. */
  storage: {
    get(key: string): string | null
    set(key: string, value: string): void
  }
}

/** An extension after activation: manifest plus everything it registered, with current enabled state. */
export interface LoadedExtension {
  manifest: ExtensionManifest
  commands: ExtensionCommand[]
  slashItems: ExtensionSlashItem[]
  panels: ExtensionPanel[]
  enabled: boolean
}

/**
 * The shape extension authors write. The loader calls `activate` once;
 * the extension registers its contributions via the provided context.
 */
export interface OpenNotesExtension {
  manifest: ExtensionManifest
  activate(ctx: {
    registerCommand(cmd: ExtensionCommand): void
    registerSlashItem(item: ExtensionSlashItem): void
    registerPanel(panel: ExtensionPanel): void
  }): void
}
