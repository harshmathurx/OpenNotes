# OpenNotes

A local-first, block-based markdown note editor. Notes live in your browser (IndexedDB) — no account, no server, no sync-to-the-cloud subscription. I built it because I wanted an Obsidian-style editor without the overhead of a full app, and to stop paying to sync notes I could just keep in my own storage.

## What it does today

- **Block-based editor** built on Tiptap/ProseMirror, with a slash (`/`) command menu for inserting headings, lists, task lists, code blocks, and images, plus a floating bubble menu for inline formatting.
- **Wikilinks** — type `[[note name]]` to link between notes; clicking a link navigates to (or creates) that note.
- **Command palette** (`Cmd+K` / `Ctrl+K`) to jump between files or run actions like "new file" and "sync now".
- **Zen mode** (`Cmd+Shift+Z`) to hide the sidebar and title bar for distraction-free writing.
- **Dark mode**, a responsive mobile layout (slide-over sidebar), and inline file renaming.
- **Local storage via IndexedDB** (Dexie) — every note persists in the browser automatically, no save button needed.

## What's scaffolded but not wired up yet

The storage layer is built around a `StorageProvider` interface (`core/storage/types.ts`), and there are working implementations for GitHub (`core/storage/github.ts`, via Octokit) and Dropbox (`core/storage/dropbox.ts`), plus a sync engine and a conflict-resolution modal for when local and remote copies diverge. None of this is connected to the UI yet — there's no OAuth flow, and `useStorage` always hands back the local provider — so right now OpenNotes runs entirely local-only in the browser. Getting one of these (GitHub first) wired end-to-end is the next real milestone.

## Tech stack

- [Next.js](https://nextjs.org) 16 (App Router, static export) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4 + [shadcn/ui](https://ui.shadcn.com) components
- [Tiptap](https://tiptap.dev) / ProseMirror for the editor, with a custom markdown serializer
- [Dexie](https://dexie.org) for IndexedDB-backed local storage
- [Octokit](https://github.com/octokit/octokit.js) and the official [Dropbox SDK](https://github.com/dropbox/dropbox-sdk-js) for the (not-yet-wired) remote providers
- [Vitest](https://vitest.dev) for tests, ESLint + Prettier for linting/formatting

## Running locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Other useful scripts:

```bash
pnpm build      # static export (output goes to dist/)
pnpm lint       # eslint
pnpm typecheck  # tsc --noEmit
pnpm vitest     # run tests
pnpm format     # prettier --write
```

## License

MIT — see [LICENSE](./LICENSE).
