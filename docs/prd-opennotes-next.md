# OpenNotes — Product North Star (v3 direction)

> *Your notes are plain markdown files in a folder you own. OpenNotes is the calm, beautiful editor on top. AI on your keys. Typography on your terms. Sync via iCloud/Dropbox/git — never via a token we hold.*

| | |
|---|---|
| Status | Living direction doc, post-v2 pivot |
| Decision owner | Product (delegated full authority) |
| Platforms | Web (instant try) → PWA → **Mac app (the real home)** |

---

## 1. The decisive pivot

**The GitHub personal-access-token flow is dead.** It asked users to mint a fine-grained token, paste it into a web app, and trust us to store it. That is the wrong security posture, the wrong UX, and the review already flagged it as "loose and hand-wavy." It dies today.

**The replacement is the architecture this product was always meant to have:**

**Notes are real `.md` files in a folder the user picks.** This is the Obsidian model, executed open-source and beautiful. It is *more* sovereign than any API sync:

- Zero tokens. Zero auth. Zero backend. **We never custody a secret.**
- Sync becomes invisible and free: put the folder in iCloud Drive or Dropbox and it syncs like magic. Or `git init` in the folder and push with *your own* SSH/agent credentials that are already on every dev's Mac.
- Users can grep, back up, version, and open their notes in any editor. True portability.

The **Mac app (Tauri)** is the real home: native folder access, macOS Keychain for the few secrets that remain (OAuth tokens, AI keys), offline-first, feels like a real app.

The **Mac app is the product**: real `.md` files in a notes folder you pick, git sync via your local git, secrets in the macOS Keychain. The web build is the same codebase for development and as a tech preview, but the Mac app is where the sovereign experience — real files on disk, git sync — lives.

## 2. The one-sentence pitch

OpenNotes is a calm, open-source markdown workspace where **your files are real files, your AI runs on your keys, and your aesthetic is yours** — sovereign on all three axes, with no account and no server holding you hostage.

## 3. Why this wins (the gap)

| | Files truly yours | AI yours | Aesthetic yours | No account | Open source | No token custody |
|---|---|---|---|---|---|---|
| Obsidian | yes | no (closed, paid sync) | plugins, messy | yes | **no** | n/a |
| Notion | **no** | theirs, metered | theirs | **no** | no | no |
| **OpenNotes** | **real `.md` files** | **BYO key / Ollama** | **Styling Studio** | **yes** | **yes** | **yes — never holds one** |

Nobody else holds the whole row. **"The notes app that never holds your secrets"** is the moat.

## 4. The three pillars + the heartbeat

1. **Files sovereignty** — plain markdown in a folder you own. Local IndexedDB cache stays as the instant web default and offline buffer. Sync is iCloud/Dropbox/git — *your* infrastructure, not ours.
2. **AI sovereignty** — Co-Writer on your Anthropic/OpenAI key or fully-local Ollama. Keys are encrypted (WebCrypto AES-GCM on web, Keychain on Mac), never on a server, never in plaintext.
3. **Aesthetic sovereignty** — Styling Studio: font, size, leading, canvas width. Calm defaults, instant apply, persisted locally.

**Heartbeat: Workspace Home** (`Cmd+Shift+H`) — daily journal, scratchpad, kanban, recent notes. The reason to open the app every morning.

## 5. Non-negotiables (trust features)

- Every keystroke lands locally first. Nothing blocks writing.
- The status indicator never lies: `saved locally` / `folder: iCloud Drive` / `unsynced (n)` / `offline`.
- No silent overwrites. Conflicts surface in-app.
- Zero telemetry. Secrets encrypted at rest. We never custody a user token.
- Cut the feature, keep the polish.

## 6. UX map

- **First run** → type immediately (local). Offer "Open a folder" when ready.
- **Home** (`Cmd+Shift+H`) → journal, scratchpad, kanban, recents.
- **Editor** → Tiptap live markdown, slash menu, wikilinks, bubble menu, zen mode.
- **Co-Writer** (`Cmd+J`) → floating panel, presets + free prompt, streams, Accept/Retry/Stop, uses selection as context.
- **Styling Studio** → title-bar popover, instant apply.
- **Command palette** (`Cmd+K`) → files + all actions.
- **Settings** → storage/folder status, AI provider config, sync health.

## 7. Storage architecture

```
React + Tiptap ──> Local vault (IndexedDB)  [source of truth + offline buffer]
                        │
              Sync engine (queue, conflicts, cadence)
                        │
        StorageProvider interface
              │
   ┌──────────┼───────────────┐
 Local      FileSystem       GitHub (browse/grant,
(IndexedDB) (folder on disk,  read-heavy; no PAT
             web FS Access /  custody; full write
             Tauri fs on Mac) via git on Mac)
```

Still no backend. Mac app = Tauri shell over the identical bundle.

## 8. Explicitly NOT now

Multi-vault, collaboration, backlinks panel, graph view, plugin API, mobile native, telemetry, accounts, subscriptions, PAT storage. Defer with grace.

## 9. Definition of done for this cycle

- Files-on-disk provider is first-class: pick a folder, persist, reconnect, read/write, surface status honestly.
- AI + Styling + Home wired in, discoverable, polished.
- API keys encrypted at rest; migration from any plaintext storage.
- GitHub repositioned: no PAT custody; honest read/grant path; Mac-app git write story documented.
- Empty/loading/error states all intentional.
- Verified by actually using it: write, journal, style, co-write, open a folder.
- `pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm exec vitest run` green.
- Tauri Mac app scaffolded (local only, not pushed).
