# PRD — OpenNotes V1

> *The smallest version of a markdown editor where your files live in your GitHub. Ship it in 8 weekends. Post it on HN. See what happens.*

| | |
|---|---|
| **Status** | Draft v0.2 — the realistic side-project cut |
| **Owner** | You |
| **Target ship date** | 8 weekends from project start (~10 weeks calendar) |
| **One-liner** | Markdown notes that live in *your* storage — GitHub, Dropbox, or just your browser. Open source. No subscription. No server to run. |
| **Success looks like** | HN front page, 3,000+ stars in 90 days, 200+ weekly active users, you're still enjoying it. |

---

## 0. What this PRD is, and isn't

This is the **V1 ship list**. Not the vision doc. The vision doc (v0.1) describes a 12–18 month project with mobile, plugin APIs, five backends, and team features. This doc describes the *first thing that goes on the internet*.

The rule: **if a feature isn't in this PRD, it doesn't ship in V1, even if it'd be cool.** Scope creep is the only thing that actually kills side projects. The v0.1 vision doc still exists as the north star for V2+ — refer back to it when you need a tiebreaker on whether something belongs in V1 or later. (Default answer: later.)

---

## 1. The bet

A web-based markdown editor that:

1. Looks beautiful enough that screenshots make HN click
2. Stores your files in *your* storage — pick from **GitHub, Dropbox, or local-only** at first run
3. Has a conflict-resolution UX and sync model that's better than `obsidian-git`
4. Installs as a PWA so it works offline and feels app-ish
5. Is fully open source from commit one

That's the entire pitch. Everything below serves these five claims.

**Why three providers, not one:** GitHub alone is the *story* (the HN-worthy wedge) but it's the wrong default for non-developers. Dropbox alone is the *bridge* to normal users (the Joplin precedent proves this pattern works) but doesn't earn the HN narrative. Local-only is the *try-it-in-5-seconds* path that converts cold visitors. The three together cover the realistic V1 audience: devs who'll pick GitHub for the principle, writers who'll pick Dropbox because they already pay for it, and curious skimmers who'll start typing immediately and pick a backend later.

**Why not more in V1:** Google Drive's "unverified app" warning screen kills conversion from cold clicks before verification (a multi-week process). WebDAV's CORS behavior varies per server and creates a support nightmare. S3 has no consumer-grade OAuth UX. iCloud has no third-party web API. All of these are V2 candidates — the right *first three* are the ones above.

**Who we're trying to win in V1:** developers on HN. That's it. Not Notion users, not students, not writers. Developers who've felt the Obsidian-Sync-vs-Git-plugin pain or who are sympathetic to the BYO-backend principle. If we win them, the rest comes later. If we don't win them, none of the rest matters.

The Dropbox provider is the early hedge: when a non-dev clicks through from the HN post and asks "wait, what's a GitHub?", they have a path forward without dropping off.

---

## 2. The 60-second user story

Sarah lands on `vellum.dev` from an HN link. She sees a one-paragraph pitch and a screenshot of a beautiful editor with the caption *"Your files in your storage. You pick where."* She clicks **Try it now.**

The app opens. Empty editor. A single line at the top: *"Start writing. Pick where to save when you're ready →"*. She types a few words. They're saved (to browser storage). She keeps writing. After two paragraphs, the *"Pick where to save"* indicator pulses gently. She clicks it.

A modal appears with three large cards:

- **GitHub** — *"Your notes in your own private repo. Free, version history included."*
- **Dropbox** — *"Your notes in your Dropbox. Syncs everywhere Dropbox does."*
- **Just this browser** — *"No account, no sync. Files live here. Connect a backend later."*

She picks Dropbox because she already pays for it. OAuth flow. She picks a folder called `Notes/OpenNotes`. Done. Her two paragraphs of typing are now in her Dropbox. She closes the tab, opens it on her phone via the PWA, signs in to Dropbox there, sees her note, taps to edit.

That whole flow is the demo. If it works smoothly in a 90-second video — and crucially, if it works *without* a sign-up wall before the user has typed anything — V1 is a success regardless of what else happens.

---

## 3. V1 feature list (ranked by ship priority)

If we have to cut, we cut from the bottom up.

### P0 — Cannot ship without

1. **The editor**
   - CodeMirror 6 base, markdown mode, GFM extensions
   - Live rendering of headers, bold/italic, lists, links, code blocks (no separate preview — inline rendering like Obsidian's live preview mode)
   - Word count + char count in the corner, fades on focus
   - Auto-save to local store every keystroke (debounced 200ms)

2. **Three storage backends**

   The same `StorageProvider` interface, three implementations:

   - **Local (browser-only)**
     - IndexedDB via Dexie, no auth, no network
     - Default for "Just this browser" — instant, zero-friction
     - Always available even when remote provider is selected, as the local-first cache
   - **GitHub**
     - OAuth via GitHub Apps (better permission scoping than classic OAuth — request access to one repo, not all repos)
     - On first connect: list user's repos OR create a new private repo named `vellum-vault`
     - Reads via Contents API; writes use Contents API for single files, Git Data API for batched commits (one commit, many files)
     - Per-sync (not per-keystroke!) commits with meaningful messages — see §3a below
   - **Dropbox**
     - PKCE OAuth from the browser, no backend needed (Dropbox explicitly supports this)
     - Path-based filesystem API — maps cleanly to vault folder structure
     - Refresh tokens for offline-capable access
     - Picks/creates a folder at first connect (default: `/Apps/OpenNotes/`)

   The storage interface includes `capabilities` that the UI reads to adjust affordances — e.g. GitHub exposes "version history" → the file menu shows a "see previous versions" option; Dropbox doesn't, so it doesn't.

3. **Local-first sync engine — provider-aware**

   This is the part you asked me to think harder about. The old plan synced every 30s for everyone. That's wrong. The new model:

   **Universal rules (apply to every backend):**
   - Every keystroke writes to local store *immediately* (sub-millisecond, never blocks)
   - Sync to remote is *always* async and *never* blocks editing
   - "Sync now" is a one-shortcut command (`Cmd+S`) that flushes immediately — your gym scenario
   - Status indicator always shows current state: `synced` / `syncing` / `unsynced (3 changes)` / `offline`

   **Per-backend sync cadence:**

   | Backend | Default sync cadence | Sync also triggered by | Why |
   |---|---|---|---|
   | Local | N/A (no remote) | — | Already on disk |
   | GitHub | **Every 30 minutes**, plus on file close, plus on `Cmd+S`, plus on tab close | Browser idle > 60s with unsynced changes | Each sync = one commit. Commit-per-keystroke is git pollution. Batching respects git semantics. |
   | Dropbox | Every 2 minutes, plus on file close, plus on `Cmd+S` | Same idle trigger | No commit semantics; faster sync is fine and feels more "live" |

   **The "I'm going to the gym" flow (your scenario, mapped):**
   1. You're mid-paragraph on your laptop. Last sync was 12 minutes ago.
   2. You hit `Cmd+S` (or click the cloud icon, or just close the tab — all do the same thing)
   3. OpenNotes batches every unsynced change into one operation:
      - On GitHub: one commit with a single message like `"vellum: 4 files updated"` (configurable to expand into per-file in the message body)
      - On Dropbox: one batched upload
   4. Indicator turns green, you close the laptop, walk to the gym
   5. On your phone: PWA opens, pulls the latest state, you keep typing
   6. When you eventually re-open laptop: it detects the remote moved, pulls down phone's changes, merges (or shows the conflict UI if you somehow touched both)

   **Why this specific design:**
   - **GitHub at 30 min default** matches your intuition and respects the platform — git history stays readable. People who write all day generate ~16 commits per workday, not 200.
   - **Manual sync is first-class**, not buried in a menu. `Cmd+S` is the muscle memory; we honor it. Most editors auto-save and treat `Cmd+S` as a no-op; we make `Cmd+S` mean "push now."
   - **The status indicator never lies.** "Unsynced (3 changes)" tells you exactly what's at risk if you close the tab. No more "did it save?" anxiety.
   - **Sync on tab close** uses `beforeunload` + `navigator.sendBeacon` where possible to flush even on hard close.

4. **Conflict resolution UI**
   - If the remote etag (GitHub) or `rev` (Dropbox) has moved when we try to write, surface a diff modal
   - Three buttons: **Keep mine** / **Keep theirs** / **Merge** (split view with conflict markers)
   - No silent overwrites, ever. This is the trust-building feature.
   - The Dropbox path benefits here too: their "conflicted copy" file naming becomes a *signal* we detect and surface inside OpenNotes, instead of leaving the user to find `note (conflicted copy 2026-05-17).md` in their Dropbox folder.

5. **File navigation**
   - A collapsible left rail (`Cmd+/` to toggle)
   - Flat-ish tree: folders and files, no drag-drop reorganize in V1 (right-click → rename/move is fine)
   - New file: `Cmd+N` opens an untitled file, name on first save
   - Search: `Cmd+P` — fuzzy filename search, fulltext is V2

6. **Slash menu** (`/`)
   - Heading 1/2/3, bulleted list, numbered list, checkbox list, code block, quote, divider, link, image
   - 9 items. That's it. No callouts, no embeds, no tables in V1.

7. **Command palette** (`Cmd+K`)
   - Open file, new file, toggle file tree, toggle zen mode, change theme, sign in/out, sync now
   - That's the whole palette in V1.

8. **Zen mode** (`Cmd+.`)
   - Hides everything except the text. No toolbar, no rail, no status.
   - This is one of the screenshots in the launch post.

9. **Wikilinks** `[[file-name]]`
   - Type `[[`, autocomplete from existing files
   - Click a wikilink, jump to the file
   - Broken links rendered in a different color
   - **No backlinks panel in V1** — that's V2. Wikilinks themselves are non-negotiable.

10. **The landing page**
    - One screen. Headline, sub-headline, screenshot, "Try it now" button, GitHub link, 90-second video.
    - This is half the launch. Treat it as a P0 deliverable, not a nice-to-have.

### P1 — Ship if time allows, cut without regret if not

11. **Dark mode toggle** — auto-detect system, manual override. Half a day of work, big screenshot win.

12. **Export current file as `.md`** — single button, one file at a time. Bulk export is V2.

13. **Frontmatter support** — render YAML frontmatter as a collapsed block at the top. Don't strip it, don't break it.

14. **Drag-drop image upload** — drops the image into the vault's `attachments/` folder, inserts the markdown image syntax. Skip if either backend's binary handling gets messy in testing.

### Explicitly NOT in V1 (resist temptation)

- Multiple vaults / multiple backends *active simultaneously* (one vault, one backend in V1; switching is supported, multi-vault is V2)
- WebDAV, S3, Supabase Storage, Firebase Storage — all V2 candidates, *intentionally* deferred so the three V1 backends ship rock-solid
- Google Drive, OneDrive, iCloud — gated by verification processes / no public API / multi-week launches in their own right
- Any backend that stores notes as database rows rather than files (Supabase Postgres, Firestore) — breaks the portability promise
- Desktop apps (Tauri or otherwise)
- Mobile (responsive web + PWA works on phone; native apps wait)
- Plugin / extension API
- Themes plural (one theme + dark mode toggle is the V1 surface)
- Backlinks panel, graph view, tags pane
- Real-time collaboration
- AI anything
- Publish-to-the-web feature
- Mermaid, KaTeX, Pikchr (extension surface for these is V2)
- Vim mode (yes, it's a HN crowd-pleaser; still V2)
- Multi-cursor, code folding, minimap
- Tables, callouts, embeds in the slash menu
- Templates, snippets, daily-notes
- Telemetry of any kind (V2 maybe, opt-in only)

**That cut list is half the point of this PRD.** Every line above is a feature someone will request in the GitHub issues within the first week. The right answer is "V2, follow the repo for updates" — not silence, not a refusal, just deferral.

---

## 4. The 8-weekend plan

Weekends, not weeks, because that's the unit you actually have. Roughly two days each, ~12 hours of focused work per weekend. Total budget: ~96 hours. Real talk: you'll lose 20% to yak-shaving. Plan for 80 productive hours.

### Weekend 1 — Skeleton + editor
- `pnpm create next-app`, Tailwind, basic layout
- CodeMirror 6 dropped in, markdown mode working, live rendering of basic elements
- Files in IndexedDB via Dexie, list/create/open/save flow
- **Ship signal:** You can write a note in the browser, close the tab, come back, and it's still there. This is also the local-only backend, working end-to-end.

### Weekend 2 — Editor polish + the look
- Slash menu (9 items)
- Command palette (Cmd+K, 7 items)
- Zen mode
- The one theme — typography, spacing, color, the *feel*. Spend disproportionate time here.
- **Ship signal:** A screenshot of the editor makes *you* want to use it.

### Weekend 3 — Storage provider interface + GitHub backend
- Define the `StorageProvider` TS interface (so backend #2 is fast next weekend)
- Implement `LocalProvider` (just wraps Dexie — should be ~50 lines)
- Implement `GitHubProvider`: GitHub App setup, PKCE OAuth, token storage encrypted in IndexedDB
- Repo picker / create-new flow
- Read/write `.md` files via Contents API
- **Ship signal:** You can connect a GitHub repo and see its `.md` files in OpenNotes, edit one, see the commit on github.com.

### Weekend 4 — Dropbox backend + the sync engine
- Implement `DropboxProvider`: PKCE OAuth (browser-native, no backend needed), folder picker, read/write via `/files/upload` and `/files/download`
- Background sync engine: queue, debounce, retry, per-provider sync cadence (30 min for GitHub, 2 min for Dropbox, configurable)
- `Cmd+S` flushes immediately; sync-on-tab-close via `beforeunload`
- Status indicator: `synced` / `syncing` / `unsynced (N changes)` / `offline`
- **Ship signal:** Connect each backend, edit on one browser, hit `Cmd+S`, refresh on another browser, changes appear. The "going to the gym" flow works.

### Weekend 5 — The hard part: conflicts (across both backends)
- Detect etag mismatch on write (GitHub) and `rev` mismatch (Dropbox)
- Diff modal: side-by-side, "Keep mine" / "Keep theirs" / "Merge manually"
- Manual merge: open both versions with conflict markers, save resolves
- Detect Dropbox "conflicted copy" files and surface them in the conflict UI rather than letting them rot in the user's Dropbox folder
- Test it nastily — edit the same file in two tabs while offline, come online, both push
- **Ship signal:** You can deliberately cause a conflict on either backend and resolve it without leaving the app or losing data.

### Weekend 6 — Wikilinks + file tree
- File tree component (collapsible folders, click to open, right-click → rename/delete/new)
- `[[wikilink]]` parsing in CodeMirror, autocomplete dropdown, click-to-navigate
- Broken-link styling
- **Ship signal:** You can build a small interconnected vault and navigate it by clicking wikilinks.

### Weekend 7 — Landing page + polish
- `vellum.dev` (or whatever you name it) — one-page site
- Three-backend story prominent: a row of logos with "your files in *your* storage" as the hero line
- Screenshot, 90-second screen recording, install-as-PWA prompt
- README with GIF, contribution guide, code of conduct, license
- Performance pass: bundle size, time-to-interactive
- **Ship signal:** A non-technical friend can land on the site, understand what it is, and try it in under 60 seconds.

### Weekend 8 — Buffer + launch
- Bug bash, edge cases (empty repo, huge files, rate limits, expired tokens, weird filenames, GitHub vs Dropbox-specific edge cases)
- Test the "switch backend with existing vault" flow (export from GitHub → import into Dropbox)
- Final demo video
- HN/Reddit/Twitter launch posts written and ready
- **Ship signal:** You hit "Post" on Show HN.

**Buffer reality check:** You will slip. Weekend 4 (sync engine + second backend) and Weekend 5 (conflicts) are the two highest-risk weekends — if you must cut, cut drag-drop image upload, frontmatter rendering, and dark mode from P1 down to V2. Sync and conflict UX are the trust features; they must not be half-baked. If you have to drop a backend mid-build, drop Dropbox (not GitHub) — GitHub is the wedge.

---

## 5. Architecture (smaller than the v0.1 PRD)

```
   ┌──────────────────────────┐
   │  Next.js app (vellum.dev)│   ← web app, deployed on Vercel
   └────────────┬─────────────┘
                │
   ┌────────────┴─────────────┐
   │  React + CodeMirror 6    │   ← editor
   │  + Tailwind              │
   └────────────┬─────────────┘
                │
   ┌────────────┴─────────────┐
   │  Local store (IndexedDB) │   ← source of truth client-side
   │  + sync queue            │
   └────────────┬─────────────┘
                │
   ┌────────────┴─────────────┐
   │  StorageProvider         │   ← single interface, three impls in V1
   │  interface (TS)          │
   └─────┬────────┬────────┬──┘
         │        │        │
         ▼        ▼        ▼
      Local    GitHub    Dropbox
   (Dexie)  (Contents +  (Files
            Git Data API) API)
```

That's it. No backend server. No database we operate. The only thing we deploy is a static Next.js bundle on Vercel's free tier. **This is critical for side-project sanity** — there's no server to wake up at 3am, no DB migration to run, no on-call rotation. If Vercel is up, OpenNotes is up.

The storage provider interface is the part that pays off forever. In V1 it has three implementations: `LocalProvider`, `GitHubProvider`, `DropboxProvider`. The contract is small enough that a community contributor can add a fourth (WebDAV, S3, Supabase Storage, Firebase Storage) over a weekend after V1 ships. That's how the long tail of backends gets built — by us defining the contract well in V1, then accepting PRs.

### Tech stack, locked

| | |
|---|---|
| Framework | Next.js 15 (App Router), client-side only — no server-side rendering in V1 |
| Editor | CodeMirror 6 + `@codemirror/lang-markdown` |
| Styling | Tailwind + a few hand-rolled CSS variables for theming |
| Local store | Dexie (IndexedDB wrapper) — simpler than wa-sqlite for V1 |
| GitHub client | `@octokit/rest` |
| Dropbox client | `dropbox` (official SDK, supports browser PKCE) |
| Auth secret storage | IndexedDB, encrypted with WebCrypto using a derived key from a passphrase the user sets on first connect — **never** in localStorage |
| Hosting | Vercel free tier |
| Domain | vellum.dev or similar, ~$15/yr |
| Analytics | None in V1. Add Plausible in V2 if needed. |

No backend. No database. No paid services. Total monthly cost: ~$1.25 for the domain amortized. Both GitHub and Dropbox support PKCE OAuth flows that work entirely from the browser, which is what makes the no-backend architecture possible. This is correct.

---

## 6. The launch

The launch is half the project. Treat it accordingly.

### The post

**Show HN title:** `Show HN: OpenNotes – A markdown editor where you bring your own storage (GitHub, Dropbox, or local)`

**Body** (rough):
> I wanted something between Obsidian's portability and Freewrite's calm — and I wanted to stop paying $8/mo to sync my notes when I have a perfectly good GitHub account. So I built OpenNotes.
>
> It's a web-based markdown editor where your files live in storage *you* control. Pick GitHub (one repo = one vault, free version history), Dropbox (PKCE-based, no backend), or just your browser. The app is a static site — there's no OpenNotes server holding your data hostage.
>
> Sync is provider-aware: GitHub batches changes into one commit every 30 minutes (no `update notes/foo.md` x200 in your git log), Dropbox syncs faster, and `Cmd+S` always pushes immediately so you can close the laptop and pick up on your phone.
>
> What's there: live-rendered markdown editor, wikilinks, conflict resolution that doesn't require Termux, three backends, works offline as a PWA. What's not there yet: mobile apps, more storage backends (WebDAV/S3/Supabase Storage coming), backlinks panel, the long tail.
>
> Apache 2.0, all on GitHub. Would love feedback, especially on the sync/conflict UX and on which storage backend you'd want added next.

### The video

90 seconds, no narration, just screen capture with text overlays. The story: open empty editor → type a note → pick a backend from the modal (Dropbox in the demo, since GitHub is the more expected pick — show the *less* expected one) → see file in Dropbox → open on phone → keep typing → trigger a conflict → resolve it in-app → done. Bookend with a frame showing the three logos and "Pick your storage. Notes are yours." If that video is good, the post will do well even if it doesn't hit front page.

### The channels (in order)

1. **Show HN** — Tuesday 9am PT is the historically best window
2. **r/ObsidianMD** — frame it as a complement, not a competitor. "Built this because Obsidian-Sync wasn't for me."
3. **r/selfhosted** — they love this stuff
4. **Lobsters** — quieter but the audience is dense with the right people
5. **Hacker News** as a comment when the inevitable "what about open source Obsidian alternatives?" thread next appears (search for these every week)
6. **Twitter/Bluesky** — one thread, one demo gif, that's it
7. **Product Hunt** — week 2, not launch week. Different audience, different timing.

Do **not** post simultaneously everywhere. Show HN first, in isolation. If it does well, the rest follow naturally. If it doesn't, the post-mortem is cleaner.

### After the launch

The first 48 hours after a successful Show HN are chaos. Be ready:

- GitHub issues will flood with feature requests. Have a `ROADMAP.md` ready that says "here's what's V2." Pin it.
- A bug will be found in production within the first hour. Have a hotfix workflow ready (Vercel auto-deploys on push to main; that's enough).
- Someone will ask if they can contribute a backend. Have `CONTRIBUTING.md` ready with the storage provider interface documented.
- Someone will ask about funding/sponsorship. Have a GitHub Sponsors page set up before you launch.

---

## 7. Success metrics (90 days post-launch)

Sized for a side-project Show HN trajectory, not a startup.

### Green — keep building, this is working
- 3,000+ GitHub stars
- 200+ weekly active users
- ≥ 5 external contributors with merged PRs
- 1+ community-contributed storage provider in progress
- You're still excited to work on it on weekends

### Yellow — re-evaluate, but don't quit
- 1,000–3,000 stars
- 50–200 WAU
- A few contributors but mostly typo fixes
- You're working on it but it feels like a chore some weeks

### Red — honest conversation with yourself
- < 1,000 stars at 90 days
- < 50 WAU
- No contributors
- You're avoiding opening the repo

Red doesn't mean kill it. It means: do a post-mortem, talk to the users you do have, and decide whether to pivot the angle (different audience? different positioning?) or pause for a bit. Side projects are allowed to nap. They're not allowed to be forced.

### Anti-metrics
Don't optimize for: time-in-app, DAU/MAU, conversion-to-anything (there's nothing to convert to). The product is a tool; the goal is that it gets used well, not used a lot.

---

## 8. What "making it big" actually looks like from here

You asked about this earlier. To be concrete about the realistic upside paths from a successful V1:

**6 months in, if V1 lands well:** You ship V2 (Tauri desktop, WebDAV, backlinks panel, mobile-friendly web). You have 10–15k stars, 1–2k WAU, and a small but real contributor base. You're known in the dev-tools-on-Twitter scene as "the OpenNotes person." This is the realistic *good* outcome.

**12 months in, with sustained momentum:** Mobile apps. Plugin API. A community of 20–50 third-party storage adapters and themes. GitHub Sponsors at $1–3k/mo. You start getting cold emails from companies who want to license OpenNotes's editor component or have you consult on their internal docs tool. This is when "side project" starts blurring into "optionality."

**18+ months, the optimistic case:** The BYO-backend pattern from OpenNotes becomes the reference implementation for a broader "your data, your storage" movement in dev tools. You write the canonical blog post. You give a conf talk. OpenNotes itself stays a tool, but you've established yourself as a builder in a specific niche, and what you do *next* benefits from that platform. This is the version where "side project" eventually becomes a real choice point — not because OpenNotes became a unicorn, but because it became a calling card.

None of these paths require OpenNotes to be your day job. All of them are compatible with the job you said you'll never give up.

---

## 9. The pre-launch checklist

Pin this. Tick it before you hit "Post."

- [ ] App works on Chrome, Firefox, Safari, latest versions
- [ ] Empty state is intentional, not blank
- [ ] First-run flow works without crashes (test in incognito with no cookies)
- [ ] GitHub disconnect/reconnect works without data loss
- [ ] Dropbox disconnect/reconnect works without data loss
- [ ] You've caused a sync conflict on both GitHub and Dropbox on purpose and resolved each from the UI
- [ ] Switching backends mid-vault doesn't lose data (export → re-import flow tested)
- [ ] `Cmd+S` flushes immediately on every backend; status indicator reflects truth
- [ ] PWA installs and works offline
- [ ] Landing page loads in < 2s on a 3G connection
- [ ] README has a GIF in the first 200px
- [ ] LICENSE file exists (Apache 2.0 recommended over MIT — patent grant matters once contributors arrive)
- [ ] CONTRIBUTING.md documents the storage provider interface — make this the headline of the doc, since backend contributions are the contribution magnet
- [ ] CODE_OF_CONDUCT.md exists (use the Contributor Covenant)
- [ ] GitHub repo description is filled, with a one-line pitch
- [ ] GitHub Sponsors page is enabled
- [ ] Domain is set up with HTTPS, SSL valid
- [ ] You have the 90-second video uploaded somewhere reliable (YouTube unlisted is fine)
- [ ] You've gotten 3 friends to do the first-run flow cold and watched them silently — at least one should pick Dropbox without coaching
- [ ] You've slept

That last one matters more than it sounds.

---

## 10. The one rule

When in doubt during the 8 weekends, the rule is:

**Cut the feature, keep the polish.**

A V1 with fewer features but a beautiful, working core will get on HN. A V1 with more features and rough edges will not. The audience we're after notices the difference between a side project shipped with care and a side project shipped with ambition. We want the former. Every weekend.

Now go build it.
