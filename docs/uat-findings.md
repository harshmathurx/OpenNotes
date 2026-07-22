# OpenNotes v2 UAT Findings

## Persona

**Nisha**, a solo founder who wants a clean Markdown notes app where she can write locally and keep a GitHub-backed vault when she is ready.

## UAT pass

Tested the first-run flow and first-note workspace on `v2` using the browser against local dev server.

## Findings

### 1. Settings is not discoverable

- **Severity:** High
- **Actual:** The workspace header had theme, zen mode, and save/sync status, but no settings entry point.
- **Expected:** A visible settings control should be present in the main header, because storage/sync is a core product promise.
- **Fix:** Added a Settings modal and a header gear button.

### 2. GitHub sync is not discoverable

- **Severity:** High
- **Actual:** GitHub sync was hidden behind `NEXT_PUBLIC_ENABLE_REMOTE_STORAGE=false`, and the visible status only said `Saved locally`.
- **Expected:** Users should see a clear `Sync to GitHub` path from Settings, with the beta/local-first posture stated honestly.
- **Fix:** GitHub sync is now visible by default unless explicitly disabled. Settings exposes `Sync to GitHub`, current storage, and sync health.

### 3. Sidebar visual frame is broken

- **Severity:** High
- **Actual:** The sidebar border/background stopped after the file list, leaving the lower sidebar area visually blank and disconnected.
- **Expected:** The sidebar should occupy full height with a stable width and clear file rail.
- **Fix:** Made the sidebar full-height, fixed-width, and shrink-safe; the desktop wrapper now owns full height.

### 4. GitHub connection copy and auth model were not clean enough

- **Severity:** Medium
- **Actual:** The GitHub dialog said remote storage was disabled while also asking for a token, and the provider attempted repo auto-creation that does not fit fine-grained tokens.
- **Expected:** v2 should use a clear no-backend fine-grained token flow: existing repo, token scoped only to that repo, Contents read/write, clear errors if access fails.
- **Fix:** Rewrote GitHub dialog copy around fine-grained tokens, documented exact token setup in README, removed silent repo auto-create, and added GitHub provider connection tests for permission/error handling.

### 5. Desktop app is tempting, but not v2

- **Severity:** Product scope
- **Actual:** macOS/Windows packaging could make local files and OS keychain storage easier, but it would expand scope before the web/local beta is clean.
- **Expected:** Finish v2 as a clean web/local-first beta first; evaluate Tauri desktop as v2.1.
- **Fix:** Kept desktop out of v2. Documented OAuth/token-broker as the better production auth path after v2.
