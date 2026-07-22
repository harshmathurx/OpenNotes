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

### 4. GitHub connection copy was contradictory

- **Severity:** Medium
- **Actual:** The GitHub dialog said remote storage was disabled while also asking for a token.
- **Expected:** Copy should say this is the GitHub beta path and explain the PAT requirement.
- **Fix:** Rewrote GitHub dialog copy around the current client-only beta path.
