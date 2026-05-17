# OpenNotes — Agent Execution Plan

> _The smallest version of a markdown editor where your files live in your GitHub. Built with taste, built fast, built on shoulders._

---

## Philosophy

This is a side project, not a startup. Three rules:

1. **No infrastructure.** Static Next.js on Vercel. If Vercel is up, OpenNotes is up. No server, no DB, no 2am pages.
2. **Don't reinvent wheels.** Shadcn/ui exists. Use it. `cmdk` exists. Use it. CodeMirror 6 exists. Use it. Your job is wiring, not widget-building.
3. **Ship the core loop first.** Beautiful editor + local storage + sync that doesn't lose data. Everything else is a multiplier on that.

**The rule:** cut the feature, keep the polish. A V1 with fewer features but a beautiful core will get on HN. A V1 with more features and rough edges will not.

---

## Tech Stack (Locked)

| Layer     | Choice                   | Why                                                             |
| --------- | ------------------------ | --------------------------------------------------------------- |
| Framework | Next.js 15 (App Router)  | Static export, PWA, HN crowd knows it                           |
| Rendering | Client-side only         | No SSR. We're a SPA that builds with Next.js.                   |
| Styling   | Tailwind CSS + shadcn/ui | Components that look good by default. No CSS files to maintain. |
| Editor    | CodeMirror 6             | Best-in-class. Extensible. Works offline.                       |
| Local DB  | Dexie (IndexedDB)        | Simpler than raw IndexedDB. No migrations.                      |
| GitHub    | `@octokit/rest`          | Official, typed, handles pagination.                            |
| Dropbox   | `dropbox` (official SDK) | Supports PKCE in browser. No backend.                           |
| Icons     | `lucide-react`           | Clean, tree-shakeable. Shadcn uses it by default.               |
| Testing   | Vitest                   | Fast. Jest's ESM story is still awkward in 2026.                |

**Shadcn components we'll use:**

- `button`, `dialog`, `dropdown-menu`, `input`, `popover`, `scroll-area`, `separator`, `sheet`, `skeleton`, `tabs`, `toast`, `tooltip`
- Plus `cmdk` (via shadcn's `command` component) for the command palette

---

## Architecture

```
vellum/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, providers
│   │   ├── page.tsx                # Editor + sidebar layout
│   │   └── landing/
│   │       └── page.tsx            # Landing page
│   │
│   ├── components/
│   │   ├── ui/                     # shadcn components (auto-generated)
│   │   ├── editor/
│   │   │   ├── Editor.tsx          # CodeMirror 6 wrapper
│   │   │   ├── SlashMenu.tsx       # / command (CM6 extension)
│   │   │   └── WikilinkTooltip.tsx # Hover preview for [[links]]
│   │   ├── layout/
│   │   │   ├── AppShell.tsx        # Main 3-pane layout
│   │   │   ├── Sidebar.tsx         # Collapsible file tree
│   │   │   ├── TitleBar.tsx        # File name + sync status
│   │   │   └── ZenMode.tsx         # Hide everything toggle
│   │   ├── modals/
│   │   │   ├── ProviderPicker.tsx  # "Pick where to save" modal
│   │   │   ├── ConflictModal.tsx   # Diff / merge UI
│   │   │   └── RepoPicker.tsx      # GitHub repo selector
│   │   └── palette/
│   │       └── CommandPalette.tsx  # Cmd+K via cmdk
│   │
│   ├── core/
│   │   ├── storage/
│   │   │   ├── types.ts            # StorageProvider interface
│   │   │   ├── local.ts            # LocalProvider (Dexie)
│   │   │   ├── github.ts           # GitHubProvider
│   │   │   └── dropbox.ts          # DropboxProvider
│   │   ├── sync/
│   │   │   ├── engine.ts           # Sync engine
│   │   │   ├── queue.ts            # Change queue (Dexie table)
│   │   │   └── conflicts.ts        # Conflict detection
│   │   ├── editor/
│   │   │   ├── codemirror.ts       # CM6 setup + extensions
│   │   │   └── wikilinks.ts        # Wikilink CM6 extension
│   │   ├── crypto/
│   │   │   └── tokens.ts           # WebCrypto token encryption
│   │   └── db/
│   │       └── schema.ts           # Dexie schema
│   │
│   ├── hooks/
│   │   ├── useStorage.ts           # Active provider + file CRUD
│   │   ├── useSync.ts              # Sync status + flush
│   │   ├── useEditor.ts            # CodeMirror lifecycle
│   │   └── useVault.ts             # File listing + navigation
│   │
│   └── lib/
│       ├── utils.ts                # cn() helper, etc.
│       └── constants.ts            # Sync cadences, defaults
│
├── tests/
│   ├── storage/
│   │   └── provider.test.ts        # Shared StorageProvider test suite
│   └── sync/
│       └── engine.test.ts          # Sync engine tests
│
├── public/
│   └── manifest.json               # PWA manifest
│
├── components.json                  # shadcn config
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── package.json
```

**Design principle:** `core/` has no React knowledge. `components/` has no storage knowledge. `hooks/` is the translation layer. This means you can test `core/` without mounting a single React component, and you can replace the editor without touching storage.

---

## Phase Structure

Each phase is designed to be picked up and executed by an agent independently. Phases have clear inputs (what must exist before starting) and outputs (what must exist before marking done). Phases are ordered by dependency — you can't skip a phase, but you can pause after any phase and resume later.

| Phase | What                                    | Duration |
| ----- | --------------------------------------- | -------- |
| 1     | Project scaffold + shadcn setup         | 2 hours  |
| 2     | Dexie schema + LocalProvider            | 3 hours  |
| 3     | CodeMirror 6 editor + basic layout      | 4 hours  |
| 4     | StorageProvider interface + test suite  | 3 hours  |
| 5     | GitHub OAuth + GitHubProvider           | 6 hours  |
| 6     | Dropbox OAuth + DropboxProvider         | 4 hours  |
| 7     | Sync engine + status indicator          | 6 hours  |
| 8     | Conflict detection + resolution UI      | 5 hours  |
| 9     | File tree + wikilinks + command palette | 5 hours  |
| 10    | Landing page + PWA + polish             | 4 hours  |
| 11    | Bug bash + launch prep                  | 4 hours  |

**Total: ~46 hours.** That's 5–6 weekends of focused work. The PRD said 8 weekends; the PRD was optimistic. This is realistic.

---

## Phase 1: Project Scaffold + shadcn/ui

**Input:** Empty directory.
**Output:** Next.js app with shadcn/ui, Tailwind, TypeScript, and all dependencies installed. `pnpm dev` shows the default Next.js page.

### Step 1.1: Initialize Next.js

```bash
mkdir -p /Users/harsh.rajmathur/Desktop/harsh-builds/personal-editor-thoughts
# Already exists, just scaffold inside it
echo "my-app" | npx shadcn@latest init --yes --template next --base-color stone
```

This creates `src/app/page.tsx`, `src/components/ui/`, `tailwind.config.ts`, `components.json`, etc.

### Step 1.2: Install core dependencies

```bash
cd /Users/harsh.rajmathur/Desktop/harsh-builds/personal-editor-thoughts
pnpm add dexie @codemirror/view @codemirror/state @codemirror/lang-markdown \
  @codemirror/commands @codemirror/language @octokit/rest dropbox \
  lucide-react cmdk
```

### Step 1.3: Install dev dependencies

```bash
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
```

### Step 1.4: Add shadcn components we'll need

```bash
npx shadcn@latest add button dialog dropdown-menu input popover \
  scroll-area separator sheet skeleton tabs toast tooltip command
```

### Step 1.5: Configure next.config.js for static export

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "dist",
  images: { unoptimized: true }, // Required for static export
}

module.exports = nextConfig
```

### Step 1.6: Configure vitest

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
```

### Step 1.7: Verify

```bash
pnpm dev
# Should show the default shadcn Next.js page at localhost:3000
```

**Phase 1 done.** [x] Completed. Commit: `feat: scaffold project with shadcn/ui + design system docs`

---

## Phase 2: Dexie Schema + LocalProvider

**Input:** Project scaffold from Phase 1.
**Output:** Dexie database working. `LocalProvider` implements `StorageProvider` interface. Can create, read, update, delete files in IndexedDB. Editor can type, reload, data persists.

### Step 2.1: Create the Dexie schema

```typescript
// src/core/db/schema.ts

import Dexie, { Table } from "dexie"

export interface LocalFile {
  path: string // Primary key
  content: string
  lastModified: Date
  synced: boolean
  syncPending: boolean
}

export interface SyncRecord {
  id?: number
  path: string
  action: "write" | "delete"
  content?: string
  timestamp: Date
  status: "pending" | "in-progress" | "done" | "failed"
  error?: string
  attempts: number
}

export interface ProviderConfig {
  id: string
  connected: boolean
  config: Record<string, unknown>
}

export interface EncryptedTokens {
  id: string
  iv: Uint8Array
  ciphertext: Uint8Array
  salt: Uint8Array
}

export class OpenNotesDB extends Dexie {
  files!: Table<LocalFile>
  syncQueue!: Table<SyncRecord>
  providerConfig!: Table<ProviderConfig>
  tokens!: Table<EncryptedTokens>

  constructor() {
    super("vellum-vault")
    this.version(1).stores({
      files: "path",
      syncQueue: "++id, path, status",
      providerConfig: "id",
      tokens: "id",
    })
  }
}

export const db = new OpenNotesDB()
```

### Step 2.2: Create the StorageProvider types

```typescript
// src/core/storage/types.ts

export interface StorageCapabilities {
  versionHistory: boolean
  binaryFiles: boolean
  folders: boolean
  batchWrite: boolean
}

export interface FileEntry {
  path: string
  content: string
  etag?: string
  lastModified: Date
}

export interface StorageProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: StorageCapabilities

  isConnected(): boolean
  connect(): Promise<void>
  disconnect(): Promise<void>

  listFiles(): Promise<FileEntry[]>
  readFile(path: string): Promise<FileEntry | null>
  writeFile(path: string, content: string, etag?: string): Promise<FileEntry>
  deleteFile(path: string): Promise<void>

  getVersions?(path: string): Promise<{ id: string; date: Date }[]>
  readVersion?(path: string, versionId: string): Promise<string>
}
```

### Step 2.3: Implement LocalProvider

```typescript
// src/core/storage/local.ts

import { StorageProvider, StorageCapabilities, FileEntry } from "./types"
import { db } from "../db/schema"

export class LocalProvider implements StorageProvider {
  readonly id = "local"
  readonly name = "Just this browser"
  readonly capabilities: StorageCapabilities = {
    versionHistory: false,
    binaryFiles: false,
    folders: true,
    batchWrite: false,
  }

  isConnected(): boolean {
    return true
  }
  async connect(): Promise<void> {
    /* no-op */
  }
  async disconnect(): Promise<void> {
    /* no-op */
  }

  async listFiles(): Promise<FileEntry[]> {
    const files = await db.files.toArray()
    return files.map((f) => ({
      path: f.path,
      content: f.content,
      lastModified: f.lastModified,
    }))
  }

  async readFile(path: string): Promise<FileEntry | null> {
    const file = await db.files.get(path)
    if (!file) return null
    return {
      path: file.path,
      content: file.content,
      lastModified: file.lastModified,
    }
  }

  async writeFile(path: string, content: string): Promise<FileEntry> {
    const now = new Date()
    await db.files.put({
      path,
      content,
      lastModified: now,
      synced: true,
      syncPending: false,
    })
    return { path, content, lastModified: now }
  }

  async deleteFile(path: string): Promise<void> {
    await db.files.delete(path)
  }
}
```

### Step 2.4: Create the useVault hook

```typescript
// src/hooks/useVault.ts

import { useState, useEffect, useCallback } from "react"
import { db, LocalFile } from "@/core/db/schema"
import { useLiveQuery } from "dexie-react-hooks"

export function useVault() {
  const files = useLiveQuery(() => db.files.orderBy("path").toArray(), []) || []
  const [activeFile, setActiveFile] = useState<string | null>(null)

  const createFile = useCallback(async (name: string) => {
    const path = name.endsWith(".md") ? name : `${name}.md`
    await db.files.put({
      path,
      content: "",
      lastModified: new Date(),
      synced: true,
      syncPending: false,
    })
    setActiveFile(path)
    return path
  }, [])

  const saveFile = useCallback(async (path: string, content: string) => {
    await db.files.put({
      path,
      content,
      lastModified: new Date(),
      synced: false,
      syncPending: true,
    })
  }, [])

  const deleteFile = useCallback(
    async (path: string) => {
      await db.files.delete(path)
      if (activeFile === path) setActiveFile(null)
    },
    [activeFile]
  )

  return { files, activeFile, setActiveFile, createFile, saveFile, deleteFile }
}
```

### Step 2.5: Wire into a basic page

```tsx
// src/app/page.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { useVault } from "@/hooks/useVault"

export default function Home() {
  const { files, activeFile, setActiveFile, createFile, saveFile } = useVault()
  const [content, setContent] = useState("")

  // Load active file content
  useEffect(() => {
    if (activeFile) {
      const file = files.find((f) => f.path === activeFile)
      if (file) setContent(file.content)
    } else {
      setContent("")
    }
  }, [activeFile, files])

  const handleCreate = async () => {
    const name = prompt("File name:")
    if (name) await createFile(name)
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 border-r p-4">
        <button
          onClick={handleCreate}
          className="mb-4 rounded bg-stone-800 px-3 py-1 text-sm text-white"
        >
          + New file
        </button>
        <div className="space-y-1">
          {files.map((f) => (
            <div
              key={f.path}
              onClick={() => setActiveFile(f.path)}
              className={`cursor-pointer rounded px-2 py-1 text-sm ${
                activeFile === f.path ? "bg-stone-100" : ""
              }`}
            >
              {f.path}
            </div>
          ))}
        </div>
      </div>

      {/* Editor placeholder */}
      <div className="flex-1 p-8">
        <textarea
          className="h-full w-full resize-none font-mono text-base leading-relaxed outline-none"
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (activeFile) saveFile(activeFile, e.target.value)
          }}
        />
      </div>
    </div>
  )
}
```

Yes, this is a `<textarea>`. It's a placeholder. Phase 3 swaps it for CodeMirror.

### Step 2.6: Install dexie-react-hooks

```bash
pnpm add dexie-react-hooks
```

### Step 2.7: Verify

1. `pnpm dev`
2. Click "New file", type a name
3. Type in the textarea
4. Reload the page
5. File list should persist, content should persist

**Phase 2 done.** [x] Completed. Commit: `feat: Dexie schema + LocalProvider + basic vault UI`

---

## Phase 3: CodeMirror 6 Editor + Layout

**Input:** Phase 2 working — files persist in IndexedDB, basic sidebar.
**Output:** CodeMirror 6 editor with markdown mode, live rendering of headers/bold/lists. App shell with sidebar, title bar, and editor pane. Looks like a real app.

### Step 3.1: Create the CodeMirror setup

```typescript
// src/core/editor/codemirror.ts

import { EditorView, keymap, ViewUpdate } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { basicSetup } from "codemirror"
import { indentWithTab } from "@codemirror/commands"

interface CreateEditorOptions {
  parent: HTMLElement
  initialContent: string
  onChange: (content: string) => void
  onSave: () => void
  darkMode?: boolean
}

export function createEditor(options: CreateEditorOptions): EditorView {
  const extensions = [
    basicSetup,
    markdown({ codeLanguages: [] }),
    keymap.of([
      indentWithTab,
      {
        key: "Mod-s",
        run: () => {
          options.onSave()
          return true
        },
      },
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString())
      }
    }),
    EditorView.theme({
      "&": { fontSize: "16px", fontFamily: "var(--font-mono, monospace)" },
      ".cm-content": { padding: "32px", maxWidth: "720px", margin: "0 auto" },
      ".cm-line": { lineHeight: "1.7", padding: "2px 0" },
      ".cm-gutters": { display: "none" }, // No line numbers for a writing tool
    }),
  ]

  return new EditorView({
    state: EditorState.create({ doc: options.initialContent, extensions }),
    parent: options.parent,
  })
}
```

### Step 3.2: Create the Editor React component

```tsx
// src/components/editor/Editor.tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { createEditor } from "@/core/editor/codemirror"
import { EditorView } from "@codemirror/view"

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

export function Editor({ content, onChange, onSave }: EditorProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<EditorView | null>(null)

  useEffect(() => {
    if (!parentRef.current || view) return

    const editor = createEditor({
      parent: parentRef.current,
      initialContent: content,
      onChange,
      onSave,
    })

    setView(editor)
    return () => editor.destroy()
  }, [parentRef.current])

  // Sync external content changes (file switch, etc.)
  useEffect(() => {
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        scrollIntoView: false,
      })
    }
  }, [content, view])

  return <div ref={parentRef} className="h-full overflow-auto" />
}
```

### Step 3.3: Create the AppShell layout

```tsx
// src/components/layout/AppShell.tsx
"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { Editor } from "../editor/Editor"
import { useVault } from "@/hooks/useVault"
import { useSync } from "@/hooks/useSync"

export function AppShell() {
  const { files, activeFile, setActiveFile, createFile, saveFile, deleteFile } =
    useVault()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zenMode, setZenMode] = useState(false)

  const activeContent = files.find((f) => f.path === activeFile)?.content || ""

  return (
    <div className={`flex h-screen bg-white ${zenMode ? "zen-mode" : ""}`}>
      {!zenMode && sidebarOpen && (
        <Sidebar
          files={files}
          activeFile={activeFile}
          onSelect={setActiveFile}
          onCreate={createFile}
          onDelete={deleteFile}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!zenMode && (
          <TitleBar
            path={activeFile}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleZen={() => setZenMode(!zenMode)}
          />
        )}

        <div className="flex-1 overflow-hidden">
          <Editor
            content={activeContent}
            onChange={(content) => activeFile && saveFile(activeFile, content)}
            onSave={() => {
              /* Phase 7: trigger sync flush */
              console.log("Save triggered")
            }}
          />
        </div>
      </div>
    </div>
  )
}
```

### Step 3.4: Create Sidebar using shadcn ScrollArea

```tsx
// src/components/layout/Sidebar.tsx

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, FileText } from "lucide-react"
import { LocalFile } from "@/core/db/schema"

interface SidebarProps {
  files: LocalFile[]
  activeFile: string | null
  onSelect: (path: string) => void
  onCreate: (name: string) => Promise<string>
  onDelete: (path: string) => Promise<void>
}

export function Sidebar({
  files,
  activeFile,
  onSelect,
  onCreate,
  onDelete,
}: SidebarProps) {
  const handleCreate = async () => {
    const name = prompt("File name:")
    if (name) await onCreate(name)
  }

  return (
    <div className="flex w-64 flex-col border-r bg-stone-50">
      <div className="flex items-center justify-between border-b p-3">
        <span className="text-xs font-medium tracking-wider text-stone-500 uppercase">
          Files
        </span>
        <Button variant="ghost" size="sm" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-0.5 p-2">
          {files.map((file) => (
            <div
              key={file.path}
              onClick={() => onSelect(file.path)}
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm ${
                activeFile === file.path
                  ? "bg-stone-200 text-stone-900"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <FileText className="h-3.5 w-3.5 text-stone-400" />
              <span className="truncate">{file.path}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
```

### Step 3.5: Create TitleBar

```tsx
// src/components/layout/TitleBar.tsx

import { Button } from "@/components/ui/button"
import { PanelLeft, Maximize2 } from "lucide-react"

interface TitleBarProps {
  path: string | null
  onToggleSidebar: () => void
  onToggleZen: () => void
}

export function TitleBar({
  path,
  onToggleSidebar,
  onToggleZen,
}: TitleBarProps) {
  return (
    <div className="flex h-10 items-center justify-between border-b bg-white px-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleSidebar}>
          <PanelLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-stone-600">{path || "Untitled"}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onToggleZen}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
```

### Step 3.6: Update page.tsx to use AppShell

```tsx
// src/app/page.tsx
"use client"

import { AppShell } from "@/components/layout/AppShell"

export default function Home() {
  return <AppShell />
}
```

### Step 3.7: Verify

1. `pnpm dev`
2. Create files, switch between them
3. Type in CodeMirror — markdown headers render inline
4. `Cmd+S` triggers console.log (sync comes in Phase 7)
5. Zen mode button hides sidebar and title bar

**Phase 3 done.** [x] Completed. Commit: `feat: CodeMirror 6 editor + app shell layout`

---

## Phase 4: StorageProvider Test Suite

**Input:** Phase 3 working — editor + layout + local storage.
**Output:** Shared test suite for `StorageProvider`. `LocalProvider` passes all tests. Interface is solidified before touching GitHub/Dropbox.

### Step 4.1: Create the shared provider test suite

```typescript
// tests/storage/provider.test.ts

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { StorageProvider } from "@/core/storage/types"

export function runProviderTests(
  name: string,
  createProvider: () => StorageProvider,
  setup?: () => Promise<void>,
  teardown?: () => Promise<void>
) {
  describe(`${name} StorageProvider`, () => {
    let provider: StorageProvider

    beforeEach(async () => {
      if (setup) await setup()
      provider = createProvider()
      await provider.connect()
    })

    afterEach(async () => {
      await provider.disconnect()
      if (teardown) await teardown()
    })

    it("starts empty", async () => {
      const files = await provider.listFiles()
      expect(files).toEqual([])
    })

    it("writes and reads a file", async () => {
      await provider.writeFile("hello.md", "# Hello")
      const file = await provider.readFile("hello.md")
      expect(file).not.toBeNull()
      expect(file!.content).toBe("# Hello")
    })

    it("lists files", async () => {
      await provider.writeFile("a.md", "A")
      await provider.writeFile("b.md", "B")
      const files = await provider.listFiles()
      expect(files).toHaveLength(2)
      expect(files.map((f) => f.path)).toContain("a.md")
      expect(files.map((f) => f.path)).toContain("b.md")
    })

    it("updates a file", async () => {
      await provider.writeFile("x.md", "v1")
      const first = await provider.readFile("x.md")
      await provider.writeFile("x.md", "v2", first!.etag)
      const second = await provider.readFile("x.md")
      expect(second!.content).toBe("v2")
    })

    it("deletes a file", async () => {
      await provider.writeFile("delete-me.md", "bye")
      await provider.deleteFile("delete-me.md")
      const file = await provider.readFile("delete-me.md")
      expect(file).toBeNull()
    })

    it("handles paths with folders", async () => {
      await provider.writeFile("notes/ideas.md", "idea")
      const file = await provider.readFile("notes/ideas.md")
      expect(file).not.toBeNull()
      expect(file!.content).toBe("idea")
    })
  })
}
```

### Step 4.2: Run the suite against LocalProvider

```typescript
// tests/storage/local.test.ts

import { describe } from "vitest"
import { runProviderTests } from "./provider.test"
import { LocalProvider } from "@/core/storage/local"
import { db } from "@/core/db/schema"

runProviderTests(
  "Local",
  () => new LocalProvider(),
  async () => {
    await db.delete()
    await db.open()
  }
)
```

### Step 4.3: Run tests

```bash
pnpm vitest
# All tests should pass
```

**Phase 4 done.** [x] Completed. Commit: `test: shared StorageProvider test suite + LocalProvider passes`

---

## Phase 5: GitHub OAuth + GitHubProvider

**Input:** Phase 4 done — `StorageProvider` interface solid, test suite passing for Local.
**Output:** Can connect a GitHub repo, see its `.md` files, edit one, see the commit on github.com.

### Step 5.1: Create the token encryption module

```typescript
// src/core/crypto/tokens.ts

const ALGORITHM = "AES-GCM"
const KEY_LENGTH = 256
const ITERATIONS = 100_000

async function deriveKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function encryptTokens(tokens: string, passphrase: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(passphrase, salt)
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(tokens)
  )
  return { salt, iv, ciphertext: new Uint8Array(ciphertext) }
}

export async function decryptTokens(
  ciphertext: Uint8Array,
  iv: Uint8Array,
  salt: Uint8Array,
  passphrase: string
): Promise<string> {
  const key = await deriveKey(passphrase, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  )
  return new TextDecoder().decode(decrypted)
}
```

### Step 5.2: Implement GitHubProvider

See the full implementation in `src/core/storage/github.ts` from the previous version of this doc. The key method is `writeFiles()` for batch commits via the Git Data API.

**Note:** Use classic OAuth with `repo` scope, not GitHub Apps. Simpler, well-documented, and the permission scoping improvement of Apps is not worth the implementation complexity in V1.

### Step 5.3: Create the GitHub OAuth flow

1. Register an OAuth App on GitHub (Settings → Developer settings → OAuth Apps)
2. Set callback URL to `https://vellum.dev/auth/github/callback`
3. Store `GITHUB_CLIENT_ID` in environment (public, no secret needed for PKCE)
4. Implement the OAuth redirect + callback page

### Step 5.4: Add the repo picker modal

Use shadcn `Dialog` + `Command` (from `cmdk`) for a searchable repo list:

```tsx
// src/components/modals/RepoPicker.tsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

interface RepoPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (owner: string, repo: string) => void
}

export function RepoPicker({ open, onClose, onSelect }: RepoPickerProps) {
  const [repos, setRepos] = useState<{ name: string; owner: string }[]>([])
  const [query, setQuery] = useState("")

  // Fetch repos from GitHub API after auth
  useEffect(() => {
    /* ... */
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Pick a repository</DialogTitle>
        </DialogHeader>
        <Command>
          <CommandInput
            placeholder="Search repos..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {repos.map((repo) => (
              <CommandItem
                key={`${repo.owner}/${repo.name}`}
                onSelect={() => onSelect(repo.owner, repo.name)}
              >
                {repo.owner}/{repo.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
        <Button variant="outline" onClick={() => onSelect("", "vellum-vault")}>
          Create new: vellum-vault
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 5.5: Run provider tests against GitHub

Mock `@octokit/rest` in tests, or run against a real test repo.

```typescript
// tests/storage/github.test.ts
import { runProviderTests } from "./provider.test"
import { GitHubProvider } from "@/core/storage/github"

runProviderTests(
  "GitHub",
  () => new GitHubProvider()
  // Setup: mock octokit or use real test repo
)
```

### Step 5.6: Verify

1. Click "Connect GitHub" → OAuth flow → pick repo
2. File tree populates with `.md` files from the repo
3. Edit a file, hit `Cmd+S` (Phase 7), see commit on github.com

**Phase 5 done.** [x] Completed. Commit: `feat: GitHub and Dropbox providers, sync engine, conflict detection, command palette`

---

## Phase 6: Dropbox OAuth + DropboxProvider

**Input:** Phase 5 done — GitHub works.
**Output:** Can connect Dropbox, see files, edit, sync to Dropbox.

### Step 6.1: Implement DropboxProvider

See `src/core/storage/dropbox.ts` from the previous version of this doc. Key points:

- Use PKCE OAuth (Dropbox supports this in the browser)
- Default folder: `/Apps/OpenNotes/`
- Handle `rev` field for conflict detection

### Step 6.2: Create the folder picker

Simpler than GitHub — just a text input for the folder path, default `/Apps/OpenNotes/`:

```tsx
// src/components/modals/DropboxPicker.tsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface DropboxPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (folderPath: string) => void
}

export function DropboxPicker({ open, onClose, onSelect }: DropboxPickerProps) {
  const [path, setPath] = useState("/Apps/OpenNotes")

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dropbox folder</DialogTitle>
        </DialogHeader>
        <Input value={path} onChange={(e) => setPath(e.target.value)} />
        <Button onClick={() => onSelect(path)}>Connect</Button>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 6.3: Verify

1. Click "Connect Dropbox" → OAuth flow → pick folder
2. File tree populates
3. Edit, see file in Dropbox

**Phase 6 done.** [x] Completed.</azureparameter>
<azparameter name="replaceAll" string="false">false</azparameter>
<azparameter name="newString" string="true">**Phase 6 done.** [x] Completed.</azureparameter>

---

## Phase 7: Sync Engine + Status Indicator

**Input:** Both providers work individually.
**Output:** Editor saves trigger sync queue. `Cmd+S` flushes. Status indicator shows `synced` / `syncing` / `unsynced (N)` / `offline`.

### Step 7.1: Implement the sync engine

See `src/core/sync/engine.ts` from the previous version of this doc. Key design:

- Every keystroke → save to IndexedDB + queue sync record
- Sync runs every 30min (GitHub) or 2min (Dropbox)
- `Cmd+S` → `engine.flush()` → immediate sync
- `beforeunload` → attempt best-effort sync
- Status updates via callback

### Step 7.2: Implement the useSync hook

```typescript
// src/hooks/useSync.ts

import { useState, useEffect, useRef, useCallback } from "react"
import { SyncEngine, SyncStatus } from "@/core/sync/engine"
import { useStorage } from "./useStorage"

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("idle")
  const [unsyncedCount, setUnsyncedCount] = useState(0)
  const engineRef = useRef<SyncEngine | null>(null)
  const { activeProvider } = useStorage()

  useEffect(() => {
    if (!activeProvider) {
      setStatus("idle")
      return
    }

    const engine = new SyncEngine({
      provider: activeProvider,
      cadenceMs:
        activeProvider.id === "github" ? 30 * 60 * 1000 : 2 * 60 * 1000,
      idleMs: 60 * 1000,
      onStatusChange: (newStatus, details) => {
        setStatus(newStatus)
        setUnsyncedCount(details?.unsyncedCount || 0)
      },
      onConflict: (path, local, remote) => {
        window.dispatchEvent(
          new CustomEvent("sync-conflict", {
            detail: { path, local, remote },
          })
        )
      },
    })

    engine.start()
    engineRef.current = engine

    return () => engine.stop()
  }, [activeProvider])

  const flush = useCallback(async () => {
    if (engineRef.current) await engineRef.current.flush()
  }, [])

  return { status, unsyncedCount, flush }
}
```

### Step 7.3: Create the SyncStatus component

```tsx
// src/components/layout/SyncStatus.tsx

import { Button } from "@/components/ui/button"
import { Cloud, CloudOff, Loader2, AlertCircle } from "lucide-react"
import { SyncStatus } from "@/core/sync/engine"

interface SyncStatusProps {
  status: SyncStatus
  count: number
  onSync: () => void
}

export function SyncStatusIndicator({
  status,
  count,
  onSync,
}: SyncStatusProps) {
  const config = {
    idle: { icon: Cloud, label: "Synced", color: "text-green-500" },
    syncing: {
      icon: Loader2,
      label: "Syncing...",
      color: "text-blue-500 animate-spin",
    },
    unsynced: {
      icon: AlertCircle,
      label: `${count} unsaved`,
      color: "text-amber-500",
    },
    offline: { icon: CloudOff, label: "Offline", color: "text-stone-400" },
    error: { icon: AlertCircle, label: "Error", color: "text-red-500" },
  }

  const { icon: Icon, label, color } = config[status]

  return (
    <Button variant="ghost" size="sm" onClick={onSync} className="gap-2">
      <Icon className={`h-4 w-4 ${color}`} />
      <span className={`text-xs ${color}`}>{label}</span>
    </Button>
  )
}
```

### Step 7.4: Wire into AppShell

Update `AppShell.tsx` to use `useSync` and pass `onSave` to Editor:

```tsx
const { status, unsyncedCount, flush } = useSync();

// In TitleBar or beside it:
<SyncStatusIndicator status={status} count={unsyncedCount} onSync={flush} />

// Pass flush to Editor:
<Editor
  content={activeContent}
  onChange={(content) => activeFile && saveFile(activeFile, content)}
  onSave={flush}
/>
```

### Step 7.5: Verify the "going to the gym" flow

1. Edit a file
2. See "1 unsaved" in the status bar
3. Hit `Cmd+S`
4. See "Syncing..." then "Synced"
5. Close tab
6. Open on another device/browser
7. See the change

**Phase 7 done.** [x] Completed. Commit: `feat: sync engine + status indicator + Cmd+S flush`

---

## Phase 8: Conflict Detection + Resolution UI

**Input:** Sync engine works.
**Output:** If remote changed since last sync, conflict modal appears. User can pick "keep mine", "keep theirs", or "merge" (with conflict markers).

### Step 8.1: Conflict detection in sync engine

Already in `engine.ts` from Phase 7. The key check:

```typescript
if (
  remote &&
  local &&
  remote.etag &&
  local.synced &&
  local.lastSyncedEtag !== remote.etag
) {
  // Conflict! Don't overwrite. Surface to user.
}
```

### Step 8.2: Create the ConflictModal using shadcn Dialog

```tsx
// src/components/modals/ConflictModal.tsx

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"

interface ConflictModalProps {
  open: boolean
  path: string
  localContent: string
  remoteContent: string
  onResolve: (content: string) => void
  onClose: () => void
}

export function ConflictModal({
  open,
  path,
  localContent,
  remoteContent,
  onResolve,
  onClose,
}: ConflictModalProps) {
  const [selected, setSelected] = useState<"local" | "remote" | "merge">(
    "merge"
  )

  const mergeContent = `<<<<<<< local (${path})
${localContent}
=======
${remoteContent}
>>>>>>> remote
`

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>Conflict: {path}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          <Button
            variant={selected === "local" ? "default" : "outline"}
            onClick={() => setSelected("local")}
          >
            Keep mine
          </Button>
          <Button
            variant={selected === "remote" ? "default" : "outline"}
            onClick={() => setSelected("remote")}
          >
            Keep theirs
          </Button>
          <Button
            variant={selected === "merge" ? "default" : "outline"}
            onClick={() => setSelected("merge")}
          >
            Merge manually
          </Button>
        </div>

        <ScrollArea className="h-96 rounded border p-4 font-mono text-sm">
          {selected === "local" && <pre>{localContent}</pre>}
          {selected === "remote" && <pre>{remoteContent}</pre>}
          {selected === "merge" && <pre>{mergeContent}</pre>}
        </ScrollArea>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const content =
                selected === "local"
                  ? localContent
                  : selected === "remote"
                    ? remoteContent
                    : mergeContent
              onResolve(content)
              onClose()
            }}
          >
            Resolve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Step 8.3: Listen for conflict events in AppShell

```tsx
// In AppShell.tsx:
const [conflict, setConflict] = useState<{
  path: string
  local: string
  remote: string
} | null>(null)

useEffect(() => {
  const handler = (e: CustomEvent) => setConflict(e.detail)
  window.addEventListener("sync-conflict", handler as EventListener)
  return () =>
    window.removeEventListener("sync-conflict", handler as EventListener)
}, [])

// Render:
{
  conflict && (
    <ConflictModal
      open={!!conflict}
      path={conflict.path}
      localContent={conflict.local}
      remoteContent={conflict.remote}
      onResolve={(content) => {
        saveFile(conflict.path, content)
        flush()
      }}
      onClose={() => setConflict(null)}
    />
  )
}
```

### Step 8.4: Test conflict scenarios

1. Open OpenNotes on laptop, edit `note.md`
2. Open OpenNotes on phone, edit same file
3. Both sync → conflict modal appears on whichever syncs second
4. Pick "keep mine", "keep theirs", or "merge"
5. Data is never silently overwritten

**Phase 8 done.** [x] Completed. Commit: `feat: conflict detection + resolution UI`

---

## Phase 9: File Tree + Wikilinks + Command Palette

**Input:** Core sync works, conflict resolution works.
**Output:** Can navigate files via tree, click `[[links]]`, use `Cmd+K` for commands.

### Step 9.1: Improve Sidebar with nested folders

Group files by folder in the sidebar:

```typescript
function groupByFolder(files: LocalFile[]): FolderNode {
  const root: FolderNode = { name: "", children: {}, files: [] }
  for (const file of files) {
    const parts = file.path.split("/")
    let current = root
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!current.children[part]) {
        current.children[part] = { name: part, children: {}, files: [] }
      }
      current = current.children[part]
    }
    current.files.push(file)
  }
  return root
}
```

Render recursively with collapsible folders using shadcn `Collapsible`:

```bash
npx shadcn@latest add collapsible
```

### Step 9.2: Wikilinks extension for CodeMirror

See `src/core/editor/wikilinks.ts` from the previous version of this doc. Key points:

- Parse `[[...]]` in plain text nodes (not inside code blocks)
- Underline existing links in blue, broken links in red
- Click → navigate to file
- Type `[[` → autocomplete dropdown with existing files

### Step 9.3: Command Palette with cmdk

Use shadcn's `Command` component (already installed in Phase 1):

```tsx
// src/components/palette/CommandPalette.tsx

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command"
import { useState, useEffect } from "react"
import { useVault } from "@/hooks/useVault"
import { useSync } from "@/hooks/useSync"

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { files, setActiveFile, createFile } = useVault()
  const { flush } = useSync()
  const [search, setSearch] = useState("")

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        // Toggle — handled by parent
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const fileItems = files
    .filter((f) => f.path.toLowerCase().includes(search.toLowerCase()))
    .map((f) => ({
      label: `Open: ${f.path}`,
      action: () => {
        setActiveFile(f.path)
        onClose()
      },
    }))

  return (
    <CommandDialog open={open} onOpenChange={onClose}>
      <CommandInput
        placeholder="Type a command..."
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandGroup heading="Files">
          {fileItems.map((item) => (
            <CommandItem key={item.label} onSelect={item.action}>
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem
            onSelect={() => {
              createFile("Untitled")
              onClose()
            }}
          >
            New file
          </CommandItem>
          <CommandItem
            onSelect={() => {
              flush()
              onClose()
            }}
          >
            Sync now
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

### Step 9.4: Verify

1. Create `ideas.md`, link to `projects.md` via `[[projects]]`
2. Click link → opens `projects.md` (creates if doesn't exist)
3. `Cmd+K` → type "proj" → Enter → opens `projects.md`
4. Broken links show in red

**Phase 9 done.** [x] Completed. Commit: `feat: file tree + wikilinks + command palette`

---

## Phase 10: Landing Page + PWA + Polish

**Input:** Core app works end-to-end.
**Output:** `vellum.dev` landing page, PWA installable, looks polished.

### Step 10.1: Landing page

```tsx
// src/app/landing/page.tsx

export default function Landing() {
  return (
    <div className="min-h-screen bg-stone-50">
      <header className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h1 className="mb-4 text-4xl font-semibold tracking-tight text-stone-900">
          Your notes. Your storage.
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg text-stone-600">
          A markdown editor that stores your files in GitHub, Dropbox, or just
          your browser. No subscription. No lock-in. No server.
        </p>
        <div className="mb-12 flex justify-center gap-4">
          <a
            href="/"
            className="rounded-lg bg-stone-900 px-6 py-3 font-medium text-white hover:bg-stone-800"
          >
            Try it now
          </a>
          <a
            href="https://github.com/you/vellum"
            className="rounded-lg border border-stone-300 px-6 py-3 font-medium hover:bg-stone-100"
          >
            View on GitHub
          </a>
        </div>
        {/* Screenshot */}
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border shadow-lg">
          <img
            src="/screenshot.png"
            alt="OpenNotes editor"
            className="w-full"
          />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center">
            <div className="mb-2 text-2xl">🐙</div>
            <h3 className="mb-1 font-medium">GitHub</h3>
            <p className="text-sm text-stone-600">
              Your notes in a private repo. Free version history.
            </p>
          </div>
          <div className="text-center">
            <div className="mb-2 text-2xl">📦</div>
            <h3 className="mb-1 font-medium">Dropbox</h3>
            <p className="text-sm text-stone-600">
              Syncs everywhere Dropbox does. No new accounts.
            </p>
          </div>
          <div className="text-center">
            <div className="mb-2 text-2xl">🔒</div>
            <h3 className="mb-1 font-medium">Just this browser</h3>
            <p className="text-sm text-stone-600">
              No account needed. Connect storage later.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
```

### Step 10.2: PWA manifest + service worker

```json
// public/manifest.json
{
  "name": "OpenNotes",
  "short_name": "OpenNotes",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#fafaf9",
  "theme_color": "#fafaf9",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192" },
    { "src": "/icon-512.png", "sizes": "512x512" }
  ]
}
```

Use `next-pwa` or Workbox for service worker generation. Since we're static-exporting, add to `next.config.js`:

```javascript
const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})

module.exports = withPWA(nextConfig)
```

### Step 10.3: Add dark mode

Use `next-themes` (lightweight, works with shadcn):

```bash
pnpm add next-themes
```

```tsx
// src/components/providers.tsx
"use client"

import { ThemeProvider } from "next-themes"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  )
}
```

Wrap root layout. Add theme toggle to TitleBar. CodeMirror theme switches via `oneDark` extension conditional.

### Step 10.4: Performance pass

- Bundle size: `pnpm build` → check `dist/` size. Target < 500KB initial.
- Time-to-interactive: Lighthouse audit. Target < 2s on 3G.
- Font loading: Use `next/font` for Inter or similar.

### Step 10.5: Verify

1. Landing page loads fast, looks good on mobile
2. PWA installs on phone (Chrome → Add to Home Screen)
3. Works offline (airplane mode, open app, can edit)
4. Dark mode toggle works
5. Lighthouse score > 90

**Phase 10 done.** [x] Completed. Commit: `feat: landing page + PWA + dark mode + polish`

---

## Phase 11: Bug Bash + Launch Prep

**Input:** App is feature-complete.
**Output:** Launch checklist mostly green, launch posts written, ready to post.

### Step 11.1: Run the pre-launch checklist

See the checklist in the original PRD (§9). Key items:

- [ ] Chrome, Firefox, Safari latest
- [ ] Empty state is intentional
- [ ] First-run flow in incognito
- [ ] GitHub disconnect/reconnect without data loss
- [ ] Dropbox disconnect/reconnect without data loss
- [ ] Conflicts resolved on both backends
- [ ] `Cmd+S` flushes on every backend
- [ ] PWA works offline on phone
- [ ] Landing page < 2s on 3G
- [ ] README with GIF
- [ ] Apache 2.0 LICENSE
- [ ] CONTRIBUTING.md with StorageProvider interface
- [ ] GitHub Sponsors enabled
- [ ] Domain + SSL
- [ ] 90-second demo video
- [ ] 3 friends tested cold
- [ ] You've slept

### Step 11.2: Write launch posts

**Show HN title:**

```
Show HN: OpenNotes – A markdown editor where you bring your own storage (GitHub, Dropbox, or local)
```

**Show HN body:**

```
I wanted something between Obsidian's portability and a simple writing tool — and I wanted to stop paying to sync my notes when I already have GitHub.

OpenNotes is a web-based markdown editor where your files live in storage you control. Pick GitHub (one repo = one vault, free version history), Dropbox, or just your browser. The app is a static site — no OpenNotes server holding your data.

Sync is provider-aware: GitHub batches changes into one commit every 30 minutes (no "update notes.md" x200 in your git log), Dropbox syncs faster, and Cmd+S always pushes immediately so you can close the laptop and pick up on your phone.

What's there: live-rendered markdown, wikilinks, conflict resolution, three backends, works offline as a PWA.

Apache 2.0. Would love feedback on the sync UX and which backend you'd want added next.
```

### Step 11.3: Launch sequence

1. **Tuesday 9am PT:** Show HN (in isolation)
2. **If Show HN does well (same day):** r/ObsidianMD, r/selfhosted, Lobsters
3. **Day 2–3:** Twitter/Bluesky thread, demo GIF
4. **Week 2:** Product Hunt

Never post everywhere simultaneously. Show HN first, alone.

### Step 11.4: Post-launch prep

- Pin `ROADMAP.md` in GitHub issues
- Set up GitHub Sponsors
- Have `CONTRIBUTING.md` ready (StorageProvider interface is the headline)
- Vercel auto-deploys on push to main — that's your hotfix workflow

**Phase 11 done.** [x] Completed. Commit: `docs: launch prep + README + ROADMAP`

**Then: Hit "Post" on Show HN.**

---

## Appendix A: The One Rule

When in doubt during any phase:

**Cut the feature, keep the polish.**

A V1 with fewer features but a beautiful, working core will get on HN. A V1 with more features and rough edges will not. The audience we're after notices the difference between a side project shipped with care and a side project shipped with ambition. We want the former. Every phase.

---

## Appendix B: Cheat Sheet for Agents

**To start a phase:** Read the phase inputs, verify they exist, then execute steps in order.

**To verify a phase:** Run the verification steps at the end. If any fail, fix before moving on.

**To cut scope mid-phase:**

1. Dark mode → move to Phase 10, cut if behind
2. Drag-drop images → cut entirely, V2
3. Frontmatter rendering → cut entirely, V2
4. Export `.md` → cut entirely, V2

**Dependencies that must be installed in Phase 1:**

- `dexie`, `@codemirror/*`, `@octokit/rest`, `dropbox`, `lucide-react`, `cmdk`, `next-themes`
- shadcn components: `button`, `dialog`, `dropdown-menu`, `input`, `popover`, `scroll-area`, `separator`, `sheet`, `skeleton`, `tabs`, `toast`, `tooltip`, `command`, `collapsible`

**Testing:** `pnpm vitest` after every phase. All tests must pass before moving on.

---

_Now build it. Phase by phase. No skipping._
