# OpenNotes

**Your notes. Real files. Your storage. Your AI.**

OpenNotes is a calm, open-source, local-first markdown workspace. Your notes stay plain `.md` files, sync runs through infrastructure you already own, and AI is opt-in on your own keys. No account, no backend, no telemetry.

[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Local-first](https://img.shields.io/badge/made%20with-local--first-informational.svg)](https://www.inkandswitch.com/local-first/)
[![Download](https://img.shields.io/github/v/release/harshmathurx/OpenNotes?include_prereleases&label=download)](https://github.com/harshmathurx/OpenNotes/releases)

<img src="screenshots/hero.png" alt="OpenNotes Mac app: a markdown note in the editor beside the Git Sync panel with the sync status banner" width="100%">

## Download

**OpenNotes is a Mac app.** Get it (Apple Silicon or Intel) from the [Releases page](https://github.com/harshmathurx/OpenNotes/releases).

The Mac app is not yet signed with an Apple certificate, so macOS will warn on first open — right-click → Open → Open to proceed. Signing is on the roadmap (see RELEASE.md).

The same codebase also runs in a browser (`pnpm dev`) for development and as a tech preview, but the Mac app is the product: it is where real files on disk and git sync live.

## Why OpenNotes

Most note tools ask you to give up at least one of three things: your files, your sync, or your AI. OpenNotes is built on the position that you shouldn't have to give up any of them.

- **Files** — notes are plain markdown. Obsidian gets this right but is closed source; Notion holds content on its servers.
- **Sync** — git, through your own local git and credentials. No hosted sync service, no subscription.
- **AI** — opt-in, on your own Anthropic/OpenAI key or a local Ollama model. Keys are encrypted on device and never touch a server.

The bet: a small, excellent core plus a clean extension API beats a bloated app.

## What works now

- **Editor** — Tiptap live-markdown editing, slash menu, wikilinks, bubble menu, zen mode, command palette (`Cmd+K`), light/dark themes.
- **Workspace Home** (`Cmd+Shift+H`) — daily journal, scratchpad, kanban, recent notes.
- **Styling Studio** — font, size, leading, and canvas width, applied instantly and persisted locally.
- **Local-first storage** — every keystroke lands in IndexedDB first; works offline; no account required.
- **Extensions** — bundled: Templates, Export (md/html/zip), Backlinks, AI Co-Writer (opt-in, off by default), and Git Sync (Mac app).

## The Mac app

OpenNotes is a Mac app (`src-tauri`, Tauri v2). It is the home of everything that makes the product sovereign:

- **Real `.md` files** in a notes folder you pick — grep them, back them up, open them in any editor.
- **Git Sync** through your local git binary with your own SSH/agent credentials — VS Code-style sync, no tokens, we never see a secret.
- **AI keys and other secrets** live in the macOS Keychain, not in browser storage.

The web build is the same codebase for development and preview, but the Mac app is the product. It is in active development; expect rough edges.

## Extensions

The app ships minimal on purpose; capabilities are extensions. Each one is a plain TypeScript object (a manifest plus `activate(ctx)`) that registers commands, slash items, and panels — no `eval`, no remote code. Third-party developers build against the same stable contract the bundled extensions use. See [docs/extensions.md](docs/extensions.md).

## Where data lives

- **Notes**: IndexedDB in your browser profile on web; real files on disk in the Mac app. There is no OpenNotes backend — note content is never uploaded anywhere by us.
- **AI keys**: encrypted on device (AES-GCM-256 via WebCrypto on web, Keychain on Mac), never in plaintext, never on a server.
- **Telemetry**: none. Accounts: none. Token custody: none.

Clearing browser site data removes locally stored notes from that profile — if your notes matter, keep them in a synced folder or an independent copy.

## Roadmap

1. Mac app + git sync, hardened end to end.
2. Community extension directory.
3. Dropbox / folder-based storage providers.
4. PWA polish and offline installability.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Then open http://localhost:3000. For the Mac app (once the Tauri toolchain is set up): `pnpm tauri:dev`.

## Validation commands

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm exec next build
```

## Contributing

Contributions welcome — extensions most of all. See [CONTRIBUTING.md](CONTRIBUTING.md); new extension ideas have their own friendly issue template ("Extension idea").

## License

[Apache-2.0](LICENSE)
