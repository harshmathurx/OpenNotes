# Review: PRD — OpenNotes V1

Context: `prd-vellum-v1.md`, an 8-weekend plan for a markdown editor where files live in the user's storage (GitHub, Dropbox, or local).

---

## What's great

### The cut list is the real feature
The "explicitly NOT in V1" section is the most important thing in the document. Every line there is a feature someone will request in week one, and the discipline to defer them all is what keeps the project alive. The rule "cut the feature, keep the polish" is correct.

### No-backend architecture is exactly right
Static Next.js on Vercel. No server. No database. No on-call. This is the only viable architecture for a side project that wants to survive beyond the launch week. Both GitHub and Dropbox support PKCE OAuth from the browser, which makes this possible.

### Per-backend sync cadence is thoughtful product design
GitHub at 30 minutes (respect git semantics), Dropbox at 2 minutes (faster, no commit pollution), Cmd+S as universal "push now" — this is not an engineer making things uniform for the sake of it. This is someone who understands that different platforms have different affordances and the UX should reflect that.

### The `capabilities` field on StorageProvider is a nice touch
GitHub exposes "version history" → the file menu shows a "see previous versions" option. Dropbox doesn't, so it doesn't. This is the kind of extensibility thinking that makes the provider interface useful beyond V1.

### Launch strategy is better than most startup PRDs
Show HN first, alone, Tuesday 9am PT. Channels in sequence, not blast. The "do not post simultaneously everywhere" advice is counterintuitive but correct — if Show HN works, the rest follow. If it doesn't, the post-mortem is cleaner. The 90-second video storyboard is the right narrative arc.

### Success metrics are honest
Green/yellow/red bands. Anti-metrics explicitly called out ("don't optimize for time-in-app"). The note that "side projects are allowed to nap" is wisdom most builders don't have.

---

## What worries me

### Weekends 3, 4, and 5 are overloaded to the point of fantasy

**Weekend 3** expects: define `StorageProvider` interface, implement `LocalProvider`, implement `GitHubProvider` with OAuth, repo picker, Contents API read/write. That's a lot but doable.

**Weekend 4** expects: implement `DropboxProvider` with OAuth, folder picker, read/write — *plus* the entire background sync engine (queue, debounce, retry, per-provider cadences, Cmd+S flush, beforeunload, status indicator with 4 states). This is two weekends of work.

**Weekend 5** expects: conflict detection (etag for GitHub, rev for Dropbox), diff modal with side-by-side view, "keep mine" / "keep theirs" / "merge manually" with conflict markers, Dropbox "conflicted copy" detection, and nasty testing across both backends. Diff visualization in the browser alone is a multi-weekend problem. The Dropbox conflicted-copy detection is a whole feature by itself.

**Recommendation:** Pad each of these by a week. Cut dark mode, frontmatter, and drag-drop image upload to explicit-V2 up front to buy the time. If you somehow finish early, pull them back in — but don't plan with them.

### The Git Data API for batched commits is genuinely hard

The flow for "one commit, many files" via GitHub's Git Data API:

1. Get the current ref (`refs/heads/main`) → get the commit SHA
2. Get the commit → get the tree SHA
3. Create new blobs for each changed file
4. Create a new tree with the new blob SHAs + existing unchanged tree entries
5. Create a new commit pointing to the new tree
6. Update the ref to point to the new commit

This is a multi-step, order-dependent, easily-broken sequence. Octokit doesn't abstract it well. If you hit a concurrent write between step 1 and step 6, you get a conflict the user didn't cause. The Contents API (single file at a time) is 10x simpler. Consider whether "one commit, many files" is worth the complexity in V1, or whether individual file commits with a consistent commit message pattern (`vellum: update notes/foo.md`) is acceptable for the first release.

### No testing strategy at all

Not even a mention in the PRD. The `StorageProvider` interface is the most important contract in the codebase. Every provider should implement against a shared test suite. Without tests:

- You won't trust the sync engine
- You won't trust the conflict resolution
- Contributors adding new backends won't know if they're compliant
- The first HN commenter who finds a data-loss bug will surface it publicly

**Recommendation:** Add a section on testing. The `StorageProvider` test suite should be written first — before any provider implementation. Each provider test should cover: read, write, conflict detection on stale write, disconnect/reconnect, empty repo, large file, special characters in filenames.

### The "try it now" flow creates a data migration problem you're only thinking about in Weekend 8

The user flow: open editor → start typing → everything saves to IndexedDB → connect a backend later → now what?

The local notes are sitting in IndexedDB. They need to be pushed to GitHub/Dropbox. This isn't just a bulk upload — it's a first-sync with a backend that now has content the user cares about. If it fails, they lose their work. If it partially succeeds, you have inconsistent state.

**Recommendation:** Design this path up front, not in the buffer weekend. The "pick a backend" modal should be tested with a vault that has 20+ existing notes in it. The first-sync should be a visible, cancellable, progress-indicating operation — not a background thing that silently fails.

### The project lives or dies by Show HN

The distribution plan has exactly one shot: Show HN. The cross-posts to r/ObsidianMD and r/selfhosted are multipliers on the HN result, not independent channels. If the Show HN post gets 3 upvotes and dies, there's no Plan B.

**Recommendation:** Hedge with 1–2 cold-traffic experiments that don't depend on HN virality:
- Seed the repo in relevant GitHub discussions (Obsidian, Logseq, Foam, Dendron)
- A single sponsored post in a dev newsletter (TLDR, Changelog, Bytes)
- The "comment when someone asks about open source Obsidian alternatives" strategy is smart — extend this to other platforms (Reddit, Discord, Twitter search)

### README stars as a primary success metric

Stars are easy to measure and feel good, but they don't correlate with usage. A repo can get 5k stars from HN and have 12 weekly active users. Stars are an ego metric. WAU, number of active vaults, and contributor PRs are the ones that matter.

**Recommendation:** Reorder the green/yellow success metrics to put WAU first, then contributors, then stars. Stars are the trailing indicator, not the leading one.

---

## Things missing from the PRD that should be there

### Large vault handling
What happens with a vault of 500+ markdown files? Initial load time, sync strategy, search performance, file tree rendering — none of this is addressed. The buffer weekend mentions "huge files" in passing but doesn't define what "huge" means or what the behavior should be.

### Offline conflict guarantees
The PRD says "no silent overwrites, ever" but doesn't define what happens when: offline → edit → come online → remote has moved → but the user already edited further. The conflict UI shows a diff, sure, but what's the actual merge strategy? Three-way merge? Last-write-wins with a backup? The details here determine whether the sync engine is trustworthy or just honest about losing your data.

### Token storage security details
The PRD says "encrypted with WebCrypto using a derived key from a passphrase the user sets on first connect." This is loose. What's the key derivation function? What's the encryption algorithm? Where is the salt stored? If the user forgets their passphrase, do they lose access to all connected backends? This needs to be specified precisely — a hand-wavy "encrypted with WebCrypto" is how auth tokens end up reversible.

### Error states and recovery
What does the user see when:
- GitHub rate limit is hit (5000 requests/hr for authenticated users)
- Dropbox API returns 429
- Token expires and refresh fails
- Network is flaky and a sync partially uploads
- IndexedDB gets corrupted (it happens, especially in private browsing)
- A file name contains characters that are valid in one backend's filenames but not another

The status indicator covers the happy path. The error states are where most sync tools fall apart.

### Accessibility
No mention of keyboard navigation, screen reader support, focus management, or color contrast. CodeMirror has decent a11y out of the box, but the custom UI (file tree, sync modal, conflict modal, slash menu) won't. HN commenters who use screen readers will surface this.

---

## Quick hits on product/messaging

### The landing page headline should lead with benefit, not mechanism
"Your files in your storage" is a mechanism. The benefit is "Your notes. No subscription. No lock-in." Or "The markdown editor that doesn't hold your data hostage." The screenshot + logos sell the mechanism; the headline should sell the feeling.

### The Show HN post opening line is about you, not the reader
> "I wanted something between Obsidian's portability and Freewrite's calm — and I wanted to stop paying $8/mo..."

Better: "OpenNotes is a markdown editor where you don't sync your notes to someone else's server. You sync them to your own GitHub repo, your Dropbox, or just your browser. No subscription, no lock-in, no 'your data on our infrastructure.'"

Lead with what exists, then explain why. The "I wanted" version is fine for a personal blog; the "here's what this is" version is better for a launch post.

### "OpenNotes" is a good name
Clean, 6 letters, not taken in a way that creates confusion, suggests something tactile and writing-adjacent. The `.dev` TLD is appropriate for the audience.

---

## Verdict

**Ship this.** It's a better-planned side project than 95% of what gets posted to HN. The thinking is clear, the cuts are honest, and the architecture is sound.

My main recommendation is not a scope change — it's a time calibration. The conflict resolution and sync engine weekends are underestimated by 2-3x. The easiest fix: cut P1 entirely up front and let those weekends stretch. If you finish early, pull dark mode back in. It's half a day of work and you'll have the time if things go well. You won't have the time if things go poorly, and dark mode is a better thing to cut than sync reliability.

Second recommendation: write the `StorageProvider` test suite first. Before any provider implementation. It will feel like overhead in Weekend 3. It will save you in Weekends 4 and 5.
