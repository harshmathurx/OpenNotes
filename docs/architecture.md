# Architecture

OpenNotes has four layers:

1. The Next.js app shell.
2. Core local-first services.
3. Extensions.
4. The Tauri desktop shell for Mac-only capabilities.

The same repository serves the browser build and the Mac app. The Mac app is the primary product surface because it can write real files, use local git, and store secrets in the macOS Keychain.

## Repository map

| Path               | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `app/`             | Next.js routes, global styles, and the landing page                        |
| `components/`      | App shell, editor UI, dialogs, command palette, and shared UI components   |
| `core/editor/`     | Markdown/editor conversion logic                                           |
| `core/vault/`      | Notes folder actions, disk mirror, save queue, folder store, and mutations |
| `core/db/`         | IndexedDB schema and persistence setup                                     |
| `core/git/`        | Git sync state, parsing, errors, and execution model                       |
| `core/bridge/`     | Runtime boundary between browser-safe code and Tauri-native commands       |
| `core/crypto/`     | Browser encryption helpers for local secrets                               |
| `core/ai/`         | AI provider presets and streaming helpers                                  |
| `core/extensions/` | Extension API, loader, registry, and store                                 |
| `core/registry/`   | Community registry schema, fetch, install, and validation logic            |
| `extensions/`      | Bundled extensions and the starter template                                |
| `src-tauri/`       | Tauri v2 app, native commands, capabilities, icons, and macOS build config |
| `tests/`           | Unit and e2e tests                                                         |

## Runtime boundaries

Browser-safe code must not assume native capabilities. Anything that touches local folders, git, dialogs, or Keychain should go through `core/bridge/*` and degrade clearly when the app is running in a browser.

The desktop shell owns:

- Folder picking and disk writes.
- Local git command execution.
- Keychain-backed secret storage.
- OS-native actions such as opening external URLs.

The browser build owns:

- IndexedDB-backed notes for development and preview.
- Browser-local encrypted settings.
- The same editor and extension surfaces where native bridges are not required.

## Extension model

An extension exports a manifest and `activate(ctx)`. During activation it can register:

- Commands for the command palette.
- Slash items for the editor menu.
- Panels for docked UI.

Extensions should keep pure logic in small modules and leave React components as thin shells. They must not store secrets, make unexpected network calls, or bypass the local-first model. See [docs/extensions.md](extensions.md).

## Local-first constraints

Changes should preserve these defaults:

- No OpenNotes account.
- No OpenNotes backend for note content.
- No telemetry.
- No hidden custody of git tokens or AI keys.
- Notes stay usable as plain markdown outside the app.

If a proposed feature needs hosted infrastructure, token custody, analytics, or remote code execution, open an issue before implementation.

## Release shape

The Mac app ships as a DMG from GitHub Releases. Release automation lives in `.github/workflows/release.yml`; release instructions live in [RELEASE.md](../RELEASE.md).

Current builds are ad-hoc signed but not notarized. Developer ID signing and Apple notarization are the next distribution hardening step.
