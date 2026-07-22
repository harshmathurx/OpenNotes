# OpenNotes — Production Readiness Plan

**Status:** Draft for review  
**Authoring lane:** Claude Code, Opus 4.8  
**Date:** 2026-07-22  
**Rule:** Do not start implementation until the review decisions in §7 are resolved.

---

## 1. Verdict

**Not production-ready under the current positioning. The app ships a promise it does not keep.**

The build is green enough to be misleading:

- `next build` passes.
- `tsc --noEmit` passes.
- `vitest run` passes: 1 file, 6 tests.
- `eslint .` fails: 13 errors, 14 warnings.

The larger problem is not build hygiene. It is product truth.

The product markets GitHub, Dropbox, and local storage. The running app is local-only:

- `hooks/useStorage.ts` hardcodes `new LocalProvider()`.
- `connectProvider` exists but is not called anywhere.
- `components/modals/ProviderPicker.tsx`, `RepoPicker.tsx`, and `DropboxPicker.tsx` are orphaned from the app flow.
- No OAuth callback routes exist under `app/`.
- `core/crypto/tokens.ts` exists but is unused.
- `core/sync/engine.ts` drains a queue that `hooks/useVault.ts` never fills.
- `detectConflicts` is imported by `core/sync/engine.ts` but never invoked.
- `README.md` is still the default Next.js template.
- `public/manifest.json` references missing icon files and there is no service worker.

This is not “a few launch bugs.” It is roughly half of the advertised product existing as scaffolding with no product path.

The honest options are:

1. **Option A:** ship a real local-first markdown editor now, with remote sync clearly marked as coming later.
2. **Option B:** defer launch and build GitHub sync end-to-end before claiming “your notes in GitHub.”

PM recommendation: **Option A now, Option B as the fast-follow.**

---

## 2. Strategic Cut

### Recommended launch cut

**OpenNotes V0 should be: a local-first markdown editor with no account, no server, and an explicit export path.**

Do not launch with GitHub/Dropbox claims until at least GitHub is wired end-to-end.

### Why this cut

- Local-first is the thing that actually works today.
- Remote sync requires OAuth, token storage, provider selection, sync queuing, remote pull, conflict handling, and deploy-time secrets. That is a feature build, not launch polish.
- A broken “Connect GitHub” path burns trust faster than not having one.
- Show HN will forgive a sharp local-first beta. It will not forgive a storage product where storage is dead code.

### Concrete implication

For launch:

- Remove or hide GitHub/Dropbox entry points from the visible product.
- Update landing/README copy to say “local-first, sync coming soon.”
- Keep remote-provider code behind a clear feature flag or leave it internal until wired.
- Add a visible “Export vault” path so the no-lock-in promise is real even before remote sync.

If Harsh chooses Option B instead, Phases 3 and 4 become launch gates.

---

## 3. Phase Plan

| Phase | Goal | Launch gate for Option A? | Launch gate for Option B? |
| --- | --- | --- | --- |
| 0 | Truth-in-advertising and repo hygiene | Yes | Yes |
| 1 | Local-first reliability | Yes | Yes |
| 2 | PWA/offline story: real or removed | Yes | Yes |
| 3 | GitHub provider wiring | No | Yes |
| 4 | Sync/conflict trust layer | No | Yes |
| 5 | Dropbox provider | No | No, fast-follow |

---

## 4. Tasks by Phase

### Phase 0 — Truth and hygiene

**Goal:** Make the repo and public surface honest.

#### Task 0.1 — Fix lint errors

**Files likely to change:**

- `app/landing/page.tsx`
- `components/editor/Editor.tsx`
- `components/editor/TiptapEditor.tsx`
- `components/editor/extensions/SlashCommand.ts`
- `components/layout/TitleBar.tsx`
- `components/palette/CommandPalette.tsx`
- `core/editor/codemirror.ts`
- `hooks/useSync.ts`
- `hooks/useVault.ts`

**Validation:**

```bash
pnpm exec eslint .
```

Expected: 0 errors. Warnings may remain only if explicitly reviewed.

#### Task 0.2 — Replace template README

**File:** `README.md`

README must include:

- What OpenNotes is today.
- What works now.
- What is intentionally not ready yet.
- How data is stored locally.
- How to run locally.
- Test/build commands.
- Roadmap: GitHub sync first, Dropbox later.
- Clear beta caveat.

Do not claim GitHub/Dropbox sync works until it does.

#### Task 0.3 — Correct landing and product copy

**Files:**

- `app/landing/page.tsx`
- `public/manifest.json`
- `docs/prd-vellum-v1.md` only if keeping docs synchronized matters before launch
- `docs/design/07-ship.md` only if launch criteria need updating

Current landing claims: “stores your files in GitHub, Dropbox, or just your browser.”

For Option A, change to something like:

> OpenNotes is a local-first markdown editor for calm, portable notes. Your files start in your browser. GitHub sync is next.

#### Task 0.4 — Decide what to do with orphaned remote UI

**Files:**

- `components/modals/ProviderPicker.tsx`
- `components/modals/RepoPicker.tsx`
- `components/modals/DropboxPicker.tsx`
- `hooks/useStorage.ts`
- `components/layout/AppShell.tsx`
- `components/palette/CommandPalette.tsx`

For Option A:

- Keep remote modals unlinked or explicitly feature-flagged.
- Do not expose dead provider-selection UI.

For Option B:

- Wire provider selection into the product path and continue to Phase 3.

---

### Phase 1 — Local-first reliability

**Goal:** Make the product’s actual current behavior trustworthy.

#### Task 1.1 — Make local persistence semantics explicit

**Files:**

- `hooks/useVault.ts`
- `core/storage/local.ts`
- `core/db/schema.ts`

Today `saveFile` writes local records with `synced: false` and `syncPending: true`, but local-only mode has no remote sync to resolve those flags. Decide and implement one clear model:

- Local-only files are “saved locally,” not “unsynced forever.”
- Remote sync pending state should only exist when a remote provider is active.

#### Task 1.2 — Add local data-loss tests

**Files:**

- `tests/storage/local.test.ts`
- `tests/storage/provider-test-helpers.ts`
- Add focused tests as needed under `tests/`

Coverage should include:

- Create file.
- Save file.
- Reload from IndexedDB.
- Rename file.
- Delete file.
- Path with nested folders.
- Large note content.
- Special characters in filenames, if supported.

#### Task 1.3 — Add editor serialization tests

**Files likely to change:**

- `components/editor/TiptapEditor.tsx`
- `core/editor/markdown.ts`
- New tests under `tests/editor/`

The recent Tiptap work makes markdown serialization the highest data-corruption risk. Add tests for:

- Headings.
- Lists.
- Task lists.
- Links.
- Wikilinks.
- Code blocks.
- Round-trip content preservation.

#### Task 1.4 — Add export vault

**Likely files:**

- `hooks/useVault.ts`
- `components/palette/CommandPalette.tsx`
- `components/layout/TitleBar.tsx`
- New utility, e.g. `core/export/zip.ts`

Product requirement:

- User can export all notes as plain `.md` files.
- No-lock-in becomes a button, not a claim.

Validation:

- Create multiple notes.
- Export vault.
- Inspect downloaded archive or generated blob contents in test.

---

### Phase 2 — PWA/offline: real or removed

**Goal:** Stop half-claiming PWA support.

Choose one.

#### Option 2A — Remove launch PWA claims

**Files:**

- `public/manifest.json`
- `app/layout.tsx`
- `app/landing/page.tsx`

Remove installability/offline claims until there is a real service worker and real icon assets.

#### Option 2B — Implement PWA properly

**Files:**

- `public/manifest.json`
- Add actual icon files referenced by the manifest.
- Add service worker setup, either manual or via project-approved package.
- `next.config.mjs` if required.

Validation:

- Lighthouse PWA installability check passes.
- App shell loads offline after first visit.
- Local notes remain accessible offline.

---

### Phase 3 — GitHub provider wiring

**Launch gate only if Option B is chosen.**

**Goal:** One remote provider, end-to-end, before Dropbox.

#### Task 3.1 — Add provider feature flag

**Files:**

- `hooks/useStorage.ts`
- `components/layout/AppShell.tsx`
- `components/palette/CommandPalette.tsx`
- `.env.example` if added

Add a single flag such as:

```text
NEXT_PUBLIC_ENABLE_REMOTE_STORAGE=false
```

Do not expose remote storage unless this is true.

#### Task 3.2 — Add GitHub OAuth route and callback

**Likely files:**

- `app/api/auth/github/start/route.ts`
- `app/api/auth/github/callback/route.ts`
- `core/storage/github.ts`
- `core/crypto/tokens.ts`
- `hooks/useStorage.ts`

Requirements:

- OAuth start path.
- Callback path.
- Token exchange.
- Token storage strategy.
- Error state if OAuth fails.

Open question: whether this remains no-server/static or requires API routes in deployment. This affects hosting architecture.

#### Task 3.3 — Wire provider selection UI

**Files:**

- `components/modals/ProviderPicker.tsx`
- `components/modals/RepoPicker.tsx`
- `components/layout/AppShell.tsx`
- `components/palette/CommandPalette.tsx`
- `hooks/useStorage.ts`

Requirements:

- User can choose GitHub.
- User can select or create a private repo.
- App persists selected provider.
- App can reconnect on reload.

#### Task 3.4 — Add GitHub provider contract tests

**Files:**

- `tests/storage/provider-test-helpers.ts`
- New GitHub provider tests, likely integration-gated

Do not run live GitHub tests by default unless credentials are available. Create a mock/conformance layer first.

---

### Phase 4 — Sync and conflict trust layer

**Launch gate only if Option B is chosen.**

**Goal:** “Synced” means the bytes reached GitHub and were verified.

#### Task 4.1 — Enqueue sync actions on save/delete/rename

**Files:**

- `hooks/useVault.ts`
- `core/sync/queue.ts`
- `core/sync/engine.ts`

Requirements:

- Save enqueues write only when a remote provider is active.
- Delete enqueues delete only when a remote provider is active.
- Rename is modeled explicitly, not as accidental delete/write unless accepted.

#### Task 4.2 — Make sync status truthful

**Files:**

- `hooks/useSync.ts`
- `components/layout/SyncStatus.tsx`
- `core/sync/engine.ts`

Requirements:

- “Saved locally” and “Synced remotely” are distinct.
- Failed sync never renders as idle/synced.
- User sees retry path.
- `Cmd+S` flushes immediately.

#### Task 4.3 — Wire conflict detection

**Files:**

- `core/sync/conflicts.ts`
- `core/sync/engine.ts`
- `components/modals/ConflictModal.tsx`
- `components/layout/AppShell.tsx`

Requirements:

- Detect remote moved since local base.
- Show conflict modal.
- Support keep mine / keep theirs / manual merge.
- Never silently overwrite remote content.

#### Task 4.4 — Add sync tests

**Files:**

- New tests under `tests/sync/`

Coverage:

- Queue created on save.
- Flush writes remote.
- Failed write remains pending.
- Conflict dispatches UI event or state.
- Retry path works.

---

### Phase 5 — Dropbox fast-follow

**Not a launch gate.**

Do this only after GitHub proves the provider contract.

**Files:**

- `core/storage/dropbox.ts`
- `components/modals/DropboxPicker.tsx`
- `hooks/useStorage.ts`
- Provider conformance tests

Do not build Dropbox before the sync contract is trustworthy with one provider.

---

## 5. Validation Gates

Before any production or public launch:

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm exec next build
```

Required results:

- ESLint: 0 errors.
- Typecheck: pass.
- Tests: pass, with meaningful coverage added beyond the current 6 local-provider tests.
- Build: pass.

Manual gates:

- Fresh browser profile: create note, edit note, reload, note persists.
- Export vault: exported markdown matches saved notes.
- Mobile viewport: create/edit/navigate works.
- Offline mode: if claimed, app works after first load with network disabled.
- If Option B: deployed preview OAuth round-trip works, remote commit appears in GitHub, forced conflict surfaces resolution UI.

---

## 6. Risks and Open Questions

### Risks

- **Marketing-code drift:** the biggest current risk. Copy says remote sync; app is local-only.
- **Data loss:** editor serialization and local persistence are under-tested.
- **Dead code rot:** GitHub/Dropbox/sync/conflict code exists without product wiring.
- **OAuth complexity:** if Option B is chosen, deployment architecture becomes more complex than the current static app story.
- **Browser storage durability:** local-only notes can still be vulnerable to browser storage eviction or private browsing behavior.
- **PWA half-state:** manifest without icons/service worker creates false confidence.

### Open questions

1. Is V0 allowed to be local-only?
2. Is export ZIP required for V0 launch?
3. Do we want PWA installability now, or should we remove that claim until V1?
4. Should GitHub sync use browser-only OAuth/PKCE or Next API routes?
5. What is the minimum acceptable test floor for editor serialization and persistence?
6. Is Dropbox definitely V1, or can it move behind GitHub validation?

---

## 7. Review Decisions Needed

Harsh should decide these before implementation:

1. **Launch scope:** Option A local-first V0, or Option B GitHub-sync-before-launch?
2. **Positioning:** Should the landing say “local-first, GitHub sync coming soon,” or should launch wait until GitHub is true?
3. **Export:** Is “export vault as markdown zip” mandatory for launch?
4. **PWA:** remove claims or implement properly?
5. **Remote architecture:** if GitHub sync proceeds, should we accept server/API routes or preserve strict static hosting?
6. **Dropbox:** launch requirement or fast-follow?

---

## 8. Recommended Next Move

Proceed with **Option A**:

1. Fix lint.
2. Replace README.
3. Correct landing copy.
4. Make local save semantics clean.
5. Add export vault.
6. Add serialization/persistence tests.
7. Remove or defer PWA claims unless implemented properly.

Then review the product as a local-first beta. If it feels worth shipping, launch honestly. If the remote-storage story is the point, do not launch until GitHub sync is real end-to-end.
