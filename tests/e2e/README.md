# OpenNotes e2e harness

A REAL end-to-end test suite for OpenNotes: the web app runs in Chromium
against the normal Next.js dev server, but the Tauri native bridge
(`core/bridge/*`) is replaced by an injected mock backed by a **real temp
folder on disk** and a **real git repo**. The full product — create/edit/
switch notes, git sync, branch switching — is driven with true assertions
(UI state **and** on-disk/git truth).

## Run

```sh
pnpm test:e2e
```

That is the only command you need. It runs
`playwright test -c tests/e2e/playwright.config.ts`, which:

1. boots the Next dev server on `:3000` if one isn't already running
   (an already-running `pnpm dev` is reused, never killed);
2. launches Chromium and runs the 5 flows in `flows.spec.ts`.

Headless by default. For a headed run / the Playwright UI:

```sh
pnpm exec playwright test -c tests/e2e/playwright.config.ts --headed
pnpm exec playwright test -c tests/e2e/playwright.config.ts --ui
```

## How the bridge mock works (no app code changes)

The app never talks to Rust directly — it calls
`@tauri-apps/api`'s `invoke()`, which in Tauri v2 is literally:

```ts
window.__TAURI_INTERNALS__.invoke(cmd, args, options)
```

and `core/bridge/runtime.ts` decides "desktop app?" with
`"__TAURI_INTERNALS__" in window`.

So `bridgeMock.ts` (`installMockBridge(page, { rootDir })`):

1. **`page.exposeFunction`** registers a Node-side dispatcher that receives
   every bridge command as JSON.
2. **`page.addInitScript`** defines `window.__TAURI_INTERNALS__` **before any
   app script runs**, with an `invoke` that forwards `{ id, cmd, args }` to
   the dispatcher and awaits the JSON reply — a tiny JSON-RPC-ish channel.

Because `__TAURI_INTERNALS__` exists, `isTauri()` returns `true` and the git
panel, folder picker, and secrets bridges all light up exactly as in the
real Mac app. The Node dispatcher implements the command surface against
the temp folder:

| Tauri command          | Mock implementation                                     |
| ---------------------- | ------------------------------------------------------- |
| `run_git`              | real `git` via `child_process.execFile` in `rootDir`    |
| `fs_list_markdown`     | recursive `.md` scan of `rootDir` (skips `.git`)        |
| `fs_read_file`         | `node:fs` read inside `rootDir` (path-escape guarded)   |
| `fs_write_file`        | `node:fs` write, creating parent folders                |
| `fs_delete_file`       | `node:fs` rm (missing file is not an error)             |
| `plugin:dialog\|open`  | returns `rootDir` (the "user picked this folder" mock)  |
| `get/set/delete_secret`| in-memory `Map` (keychain stand-in)                     |

The app code is **completely unchanged** — everything is injected from the
outside, which is the whole point: we test the real product against a real
filesystem and real git.

Each test gets a fresh `os.tmpdir()/opennotes-e2e-*` folder, so tests are
independent and parallel-safe.

## The 5 flows (`flows.spec.ts`)

1. **Write a note → lands on disk.** — currently `test.skip`: the vault
   write path (`useVault`/`AppShell`) doesn't yet route through
   `FolderVaultStore` (the disk mirror), so notes only hit IndexedDB. The
   mock's `fs_write_file` is ready; unskip when the disk-write stream lands.
2. **Two notes + switching** (content-bleed regression). ✅ passes.
3. **Reconcile-on-launch** — `test.skip`: `reconcileFromDisk` exists in
   `core/vault/diskMirror.ts` but nothing calls it at launch from the live
   UI yet. Unskip when launch reconcile is wired.
4. **Git Sync commit** (regression for "commit finds nothing"): real repo,
   real commit asserted via `git log`/`git show`. ✅ passes.
5. **Branch menu** (regression for the branch-picker crash): asserts no
   `pageerror` and the current branch is listed. ✅ passes.

## Files

- `bridgeMock.ts` — the injectable `__TAURI_INTERNALS__` mock + Node handlers.
- `fixtures.ts` — temp workspace + real-git helpers.
- `server.ts` — reuse/boot the dev server on `:3000`.
- `globalSetup.ts` / `globalTeardown.ts` — server lifecycle.
- `playwright.config.ts` — suite config (separate from vitest).
- `flows.spec.ts` — the 5 flows.
