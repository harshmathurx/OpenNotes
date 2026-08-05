# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-05

First public-ready state of the workspace.

### Added

- **Editor** — Tiptap live-markdown editing with slash menu, wikilinks, bubble menu, zen mode, command palette (`Cmd+K`), and light/dark themes.
- **Workspace Home** (`Cmd+Shift+H`) — daily journal, scratchpad, kanban, and recent notes.
- **Styling Studio** — font, size, leading, and canvas width controls, applied instantly and persisted locally.
- **Local-first storage** — every keystroke lands in IndexedDB first; fully offline-capable; no account.
- **Extension system** — stable manifest + `activate(ctx)` contract for commands, slash items, and panels (see `docs/extensions.md`). Bundled extensions: Templates, Export (md/html/zip), Backlinks, AI Co-Writer (opt-in, off by default), Git Sync.
- **Mac app (in active development)** — Tauri v2 desktop app with real `.md` files in a user-picked notes folder, Git Sync via the local git binary and the user's own SSH/agent credentials (VS Code-style, no token custody), and secrets in the macOS Keychain.
- **AI Co-Writer** — opt-in, bring-your-own Anthropic/OpenAI key or local Ollama; keys encrypted on device with AES-GCM-256.

[Unreleased]: https://github.com/harshmathurx/OpenNotes/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/harshmathurx/OpenNotes/releases/tag/v0.1.0
