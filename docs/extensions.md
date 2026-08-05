# Building OpenNotes Extensions

OpenNotes is a calm, local-first markdown workspace. The **core app is intentionally minimal** — a beautiful editor, a workspace home, and local-first storage. Everything else — Git sync, the AI Co-Writer, templates, backlinks, export — is an **extension**. This guide shows you how to build your own.

> The bet: a small, excellent core plus a clean extension API beats a bloated app. If a capability isn't universal, it belongs in an extension.

---

## 1. What an extension is

An extension is a **plain TypeScript object**: a `manifest` plus an `activate(ctx)` function. During `activate` you register **commands** (command palette), **slash items** (the editor's `/` menu), and **panels** (a dockable side region). There is **no `eval`, no remote code** — extensions are statically imported and compiled with the app.

```ts
import type { OpenNotesExtension } from "@/core/extensions/types"

export const myExtension: OpenNotesExtension = {
  manifest: {
    id: "word-count-plus",          // unique, stable, kebab-case
    name: "Word Count Plus",
    version: "0.1.0",
    description: "Live word and reading-time stats for the current note.",
    author: "Your Name",
    defaultEnabled: true,            // optional; defaults to true
  },

  activate(ctx) {
    ctx.registerCommand({ /* ... */ })
    ctx.registerSlashItem({ /* ... */ })
    ctx.registerPanel({ /* ... */ })
  },
}
```

That's the whole shape. The runtime handles activation, enable/disable persistence, namespacing, and surfacing your contributions in the UI.

---

## 2. Where extensions live

Bundled extensions live in `extensions/<your-id>/`:

```
extensions/
  word-count-plus/
    index.ts          # the OpenNotesExtension (manifest + activate)
    MyPanel.tsx       # optional panel component(s)
    engine.ts         # optional pure logic (keep it testable)
    copy.ts           # optional user-facing strings in one place
```

Register it once in `core/extensions/loader.ts` (add to `BUNDLED_EXTENSIONS`), and it ships with the app.

Tests live in `tests/extensions/<your-id>.test.ts`.

---

## 3. The API surface

Every command, slash item, and panel receives an `OpenNotesExtensionAPI`. It's intentionally small — extensions can read and act on notes and the editor, show toasts, store namespaced data, and (optionally) use the AI bridge. **It cannot touch the network, the filesystem, or other extensions' data.**

```ts
interface OpenNotesExtensionAPI {
  // --- Notes ---
  getActiveNote(): { path: string; content: string } | null
  getNotes(): Array<{ path: string; content: string }>
  openNote(path: string): void
  createNote?(name?: string): Promise<string | null>

  // --- Editor ---
  getSelection?(): string
  replaceSelection?(markdown: string): void
  insertIntoActiveNote(markdown: string): void
  setActiveNoteContent?(markdown: string): void

  // --- Feedback ---
  showToast(message: string): void

  // --- Optional AI bridge (present only when AI is configured) ---
  ai?: {
    available(): boolean
    complete(prompt: string, options?: { system?: string }): Promise<string>
  }

  // --- Namespaced storage (strings only, no secrets) ---
  storage: {
    get(key: string): string | null
    set(key: string, value: string): void
  }
}
```

**Design rules**
- Always handle `null` from `getActiveNote()` and `getSelection()` — there may be no active note or no selection.
- `storage` is namespaced by your extension id automatically (`opennotes-ext-storage:<id>:<key>`). Strings only. **Never store secrets** — the AI key flow is the only sanctioned secret path and it lives in the host.
- Optional methods (`createNote`, `getSelection`, `replaceSelection`, `setActiveNoteContent`) may be absent depending on host capabilities — feature-detect before calling.
- `ai` is present **only** when the user has configured an AI provider. Check `api.ai?.available()` before use and degrade gracefully.

---

## 4. Contribution types

### Commands — the command palette (`Cmd+K`)

```ts
ctx.registerCommand({
  id: "insert-date",                  // unique within your extension
  title: "Insert today's date",
  run(api) {
    const today = new Date().toISOString().slice(0, 10)
    api.insertIntoActiveNote(today)
  },
})
```

Commands can be async. They're only surfaced when your extension is **enabled**. Registry keys them as `<extension-id>:<command-id>`.

### Slash items — the editor `/` menu

```ts
ctx.registerSlashItem({
  id: "divider",
  title: "Divider",
  description: "Insert a horizontal rule",
  insert(api) {
    return "\n---\n"                  // markdown inserted at the cursor
  },
})
```

`insert` returns the markdown string to insert; it may be async.

### Panels — a dockable side region

Panels are the most powerful contribution: a persistent React component docked to the right of the editor (Git Sync, Backlinks, Export are panels).

```tsx
ctx.registerPanel({
  id: "stats",
  title: "Stats",
  icon: "BarChart3",                  // any lucide-react icon name
  side: "right",                      // "left" | "right" (default "right")
  component: MyStatsPanel,            // React component receiving { api }
})
```

```tsx
function MyStatsPanel({ api }: { api: OpenNotesExtensionAPI }) {
  const note = api.getActiveNote()
  if (!note) return <p>Open a note to see stats.</p>
  const words = note.content.split(/\s+/).filter(Boolean).length
  return <div>{words} words</div>
}
```

The host mounts your component when the panel is active and passes the live `api`. Keep panels calm and consistent with the app's design language (see §7).

---

## 5. A complete, minimal example

`extensions/hello/index.ts`:

```ts
import type { OpenNotesExtension } from "@/core/extensions/types"

export const helloExtension: OpenNotesExtension = {
  manifest: {
    id: "hello",
    name: "Hello",
    version: "0.1.0",
    description: "A tiny example extension.",
    author: "OpenNotes",
  },
  activate(ctx) {
    ctx.registerCommand({
      id: "greet",
      title: "Say hello",
      run(api) {
        const note = api.getActiveNote()
        api.showToast(note ? `Hello from ${note.path}` : "Hello! Open a note first.")
      },
    })
  },
}
```

Register it in `core/extensions/loader.ts`:

```ts
import { helloExtension } from "@/extensions/hello"
const BUNDLED_EXTENSIONS = [/* ... */, helloExtension]
```

Done. `Cmd+K` → "Say hello".

---

## 6. Testing your extension

Keep logic in **pure, framework-free functions** (an `engine.ts`) so it's trivially unit-testable. Panels/commands become thin wrappers.

```ts
// tests/extensions/word-count-plus.test.ts
import { describe, it, expect } from "vitest"
import { countWords } from "@/extensions/word-count-plus/engine"

describe("countWords", () => {
  it("counts words and ignores markdown syntax", () => {
    expect(countWords("# Hi\n\nSome **bold** text.")).toBe(4)
  })
})
```

Stub the `api.storage` shape with an in-memory object for storage tests. Run:

```bash
pnpm exec vitest run tests/extensions
pnpm exec tsc --noEmit
pnpm exec eslint extensions/word-count-plus
```

All three must be green before you open a PR.

---

## 7. Design & quality bar

OpenNotes is a **calm** tool. Extensions should feel native, not bolted on.

- **Match the design language.** Use existing tokens (`bg-background`, `border-border`, `text-muted-foreground`, `rounded-lg`) and `cn()` from `@/lib/utils`. Use `lucide-react` icons. **No emojis.**
- **Honest states.** Loading, empty, and error states are part of the feature. Never show a blank panel or a silent failure.
- **No silent overwrites.** If your extension modifies a note, be explicit about it.
- **Respect the local-first promise.** No telemetry, no unexpected network calls, no holding user data.
- **Accessible.** `aria-label`s on icon buttons, keyboard-navigable, AA contrast.

---

## 8. Built-in extensions as references

Study these — they are the canonical patterns:

| Extension | Shows you |
|---|---|
| `extensions/gitSync` | A rich panel with a state machine, external-process bridge, honest error surfacing |
| `extensions/templates` | Variable substitution, user-defined data, dynamic slash items |
| `extensions/export` | Pure builders + download workflow, reusing core modules |
| `extensions/backlinks` | A link graph over all notes, click-to-navigate |
| `extensions/aiCowriter` | The AI bridge + opt-in (`defaultEnabled: false`) pattern |

---

## 9. Sharing & installing extensions (roadmap)

**Today:** extensions are bundled with the app. To share one, open a pull request adding it under `extensions/`. We review for quality, design fit, and the local-first promise. Accepted extensions ship with the next release and can be toggled in **Settings → Extensions**.

**Coming with the Mac app:** a **community extension directory**.
- A public registry (a curated index in the OpenNotes repo) listing community extensions with name, description, author, and repo.
- The desktop app installs an extension by reading a folder from disk (`manifest.json` + a sandboxed entry module), validating it against the same `OpenNotesExtension` contract in `core/extensions/types.ts`, and registering it with the **same** registry — no core changes.
- Sandboxing (isolated realm + a capability allowlist) is enforced by the host. The contract you write against **today** is identical for bundled and installed extensions — nothing you build now will need to change.

The contract in `core/extensions/types.ts` is the stable public API. We version it deliberately and avoid breaking changes.

---

## 10. The one rule

**Make it excellent or make it smaller.** A tiny extension that does one thing beautifully is more valuable than a large one that's rough. The core app stays minimal on purpose — your extension is where depth lives.
