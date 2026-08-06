# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added a public architecture map for contributors.
- Added support and governance docs.
- Added issue-template contact links for security reports and support.

### Changed

- Reworked the README for OSS visitors: current status, download caveat, project map, extension entry points, and contribution paths are now easier to scan.
- Expanded contributor guidance around architecture boundaries and extension work.
- Tightened the security policy around local-first risks, native bridge scope, and disclosure expectations.

## [0.1.2] - 2026-08-06

### Fixed

- `Report a bug` now opens a prefilled GitHub issue in the system browser from the Mac app.
- The web build keeps its existing browser fallback.
- Package, Tauri config, and Rust crate versions are aligned at `0.1.2`.

## [0.1.1] - 2026-08-05

### Added

- Published the first downloadable Mac build of OpenNotes v2 as an Apple Silicon DMG.
- Added release assets and a SHA-256 checksum on GitHub Releases.
- Shipped the v2 workspace surface: markdown editing, workspace home, export, backlinks, templates, AI Co-Writer, and Git Sync.

## [0.1.0] - 2026-08-05

First public-ready state of the workspace.

### Added

- Tiptap live-markdown editing with slash menu, wikilinks, bubble menu, zen mode, command palette (`Cmd+K`), and light/dark themes.
- Workspace Home (`Cmd+Shift+H`) with daily journal, scratchpad, kanban, and recent notes.
- Styling Studio with font, size, leading, and canvas width controls, applied instantly and persisted locally.
- Local-first storage: every keystroke lands in IndexedDB first; fully offline-capable; no account.
- Extension system with a stable manifest plus `activate(ctx)` contract for commands, slash items, and panels. Bundled extensions include Templates, Export, Backlinks, AI Co-Writer, and Git Sync.
- Tauri v2 desktop app with real `.md` files in a user-picked notes folder, Git Sync through the local git binary and the user's own SSH/agent credentials, and secrets in the macOS Keychain.
- AI Co-Writer: opt-in, bring-your-own Anthropic/OpenAI key or local Ollama; keys encrypted on device with AES-GCM-256.

[Unreleased]: https://github.com/harshmathurx/OpenNotes/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/harshmathurx/OpenNotes/releases/tag/v0.1.2
[0.1.1]: https://github.com/harshmathurx/OpenNotes/releases/tag/v0.1.1
[0.1.0]: https://github.com/harshmathurx/OpenNotes/releases/tag/v0.1.0
