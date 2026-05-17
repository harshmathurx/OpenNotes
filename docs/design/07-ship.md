# 07-ship.md — Handoff, QA, Taste, Direction

## Design Handoff

### Handoff Artifacts Per Feature

Each feature ships with:

- **Component specs** referencing `05-components.md` by component name
- **Exact CSS variable tokens** (e.g., `bg-primary`, `text-muted-foreground`) — never raw hex
- **Interaction specs** with duration, easing, reduced-motion fallback
- **Final copy** from `04-voice-and-tone.md` — no placeholder text, no "TBD"
- **All states:** default, hover, active, disabled, loading, error, empty, offline
- **Responsive behavior** at 3 breakpoints: desktop, tablet, mobile
- **Accessibility annotations:** tab order, ARIA roles, aria-live regions, alt text

### Design-Engineering Contract

| Responsibility        | Design Owns                                            | Engineering Owns                         |
| --------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Visual specifications | Color tokens, type scale, spacing, border radius       | Performance optimization of CSS          |
| Component behavior    | Interaction specs, animation curves, state transitions | React implementation, event handling     |
| Content               | All UI copy, error messages, labels, tooltips          | Content rendering, truncation, overflow  |
| Accessibility         | Tab order, ARIA roles, landmark structure              | Platform behavior, focus management code |
| Testing               | Acceptance criteria, visual QA                         | Unit tests, integration tests, E2E       |

**Negotiable:** Animation timing (±50ms), exact layout for edge-case overflow, responsive breakpoint values (±20px).

**Non-negotiable:** Color tokens (CSS variables only), type scale, component copy, focus behavior, touch target minimums.

### Redline

All measurements reference **design tokens**, not pixel values:

- `space-md` not `16px`
- `text-sm` not `14px`
- `rounded-lg` not `8px`

---

## Design QA

After build, review in this order:

### 1. Visual QA

- [ ] Colors match tokens (use browser devtools to inspect CSS variables)
- [ ] Typography matches scale (font family, size, weight, line height)
- [ ] Spacing matches system (inspect padding, margin, gap)
- [ ] Component variants all render (button primary/secondary/ghost/destructive)
- [ ] Test on actual device (not just Chrome responsive mode)

### 2. Interaction QA

- [ ] Animations match specs (duration, easing, stagger)
- [ ] Test with `prefers-reduced-motion: reduce`
- [ ] No jank on scroll or animation (60fps minimum)
- [ ] Modal open/close is smooth
- [ ] Zen mode toggle is smooth

### 3. Content QA

- [ ] Every string matches `04-voice-and-tone.md`
- [ ] No placeholder text ("lorem ipsum", "Coming soon")
- [ ] No emoji in UI (except brand illustrations if any)
- [ ] Truncation behavior tested (very long filenames)
- [ ] Error messages follow what/why/next framework

### 4. State QA

- [ ] Default state — normal usage
- [ ] Empty state — first run, no files, empty search
- [ ] Loading state — sync in progress (spinner)
- [ ] Error state — sync failed, offline, conflict
- [ ] Maxed state — 100+ files in sidebar
- [ ] Restricted state — no storage connected yet

### 5. Accessibility QA

- [ ] Tab through every screen — order makes sense
- [ ] Screen reader announces: sidebar, file items, sync changes, modals
- [ ] All contrast ratios pass (verify with axe DevTools)
- [ ] Zoom to 200% — everything reflows, nothing hidden
- [ ] Keyboard-only: create file, switch files, sync, delete

### 6. Responsive QA

- [ ] Desktop (1440px+): sidebar + editor + white space
- [ ] Laptop (1024px): sidebar (200px) + editor
- [ ] Tablet (768px): collapsible sidebar, full editor
- [ ] Mobile (375px): Sheet sidebar, full-width editor
- [ ] Test at arbitrary sizes between breakpoints

### Issue Classification

| Severity     | Definition                                              | Resolution              |
| ------------ | ------------------------------------------------------- | ----------------------- |
| Blocking     | Affects usability, accessibility, or data integrity     | Must fix before ship    |
| Should-fix   | Visual inconsistency, copy deviation, minor UX friction | Fix before next release |
| Nice-to-have | Polish, subtle improvement, edge case                   | Track in backlog        |

**Done:** All blocking resolved. Should-fix tracked in GitHub issues.

### Design Debt

| Item                          | Compromise                               | Impact                            | Revisit                          |
| ----------------------------- | ---------------------------------------- | --------------------------------- | -------------------------------- |
| No visual editor for markdown | Pure CodeMirror (plain text + rendering) | Users type raw markdown           | Post-V1 if requested             |
| No collaboration features     | Requires server and auth                 | Single-user only                  | Post-V2 (depends on demand)      |
| No mobile app                 | PWA only (static site)                   | Full PWA works but no native feel | Post-launch                      |
| No rich media embeds          | Plain markdown only                      | Can't embed images/tweets/files   | Post-V1                          |
| Single active file at a time  | No tabs                                  | Must switch files like Notion     | Intentional — one note at a time |

**Monthly review in GitHub issue labeled `design-debt`.**

---

## Build Direction

### Thesis

OpenNotes gives writers the best markdown writing surface on the web — beautiful, offline-first, and connected to storage they already own. No new accounts. No new platforms. Just a clean editor and your files exactly where you want them.

### Phase Roadmap

**Phase 1 (ships now):**

- Clean markdown editor with CodeMirror 6
- Local storage via IndexedDB (Dexie)
- File sidebar with create/delete/navigate
- Cmd+K command palette
- Wikilinks ([[ ) with autocomplete
- Zen mode toggle
- Landing page
- PWA installable
- Theme toggle (light/dark)

**Phase 2 (ships after validation, unlocked by > 100 DAU):**

- GitHub OAuth + sync to private repo
- Dropbox OAuth + sync to folder
- Sync engine with cadenced + manual (Cmd+S) flush
- Conflict detection + resolution modal
- Nested folder view in sidebar

**Phase 3 (exploratory, unlocked by > 1000 DAU):**

- Graph view (like Obsidian)
- Backlinks panel
- Tags / frontmatter
- Custom storage providers via StorageProvider interface
- Native desktop app (Tauri)

**Not-candidates-ever:**

- Collaboration / multi-user editing (requires server, violates data ownership principle)
- Non-markdown file formats (violates portability principle)
- AI features that read user content (violates privacy)
- Subscription pricing (user owns storage, not us)

### Quality Bar (Launch Criteria)

- [ ] Architecture: `core/` has 0 React imports (testable without DOM)
- [ ] Storage: create, read, update, delete files in IndexedDB
- [ ] Editor: CodeMirror 6 renders markdown live
- [ ] Sync: Cmd+S flushes, status indicator updates
- [ ] Offline: editor works with airplane mode (local storage)
- [ ] Type safety: 100% TypeScript, no `any`, no `unknown` except where API-mandated
- [ ] Type scale: all type uses design tokens
- [ ] Color: all colors use CSS variables (no inline hex)
- [ ] Motion: all animations degrade with prefers-reduced-motion
- [ ] Copy: every string follows voice guide
- [ ] Accessibility: AA contrast, keyboard navigable
- [ ] Metrics: core events instrumented
- [ ] Empty states: no broken empty states anywhere
- [ ] Landing: < 2s load on 3G

### Taste References

| Reference       | What We're Taking                                                      | What We're NOT Taking                                        |
| --------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Notion**      | Clean white aesthetic, cmd+k palette, calm composability               | Block-based editor, proprietary format, managed cloud        |
| **Linear**      | Keyboard-first, dark mode, sync as background, confident green accents | Issue tracking complexity, list-heavy UI                     |
| **Obsidian**    | Wikilinks, local-first, markdown purity, file ownership                | Plugin complexity, graph view (Phase 3), technical aesthetic |
| **iA Writer**   | Focus mode, monospace writing, one-thing-well philosophy               | macOS only, no wikilinks, paid                               |
| **Apple Notes** | Zero friction to create, instant sync feel                             | Platform lock-in, limited formatting                         |
| **Arc Browser** | Smooth animations, spatial feel, sidebar elegance                      | Browser complexity, tab management                           |

### Anti-References

| Anti-Reference                 | Specific Pattern                                            | Why It Fails                                                                                               |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Google Docs**                | Toolbar-hoarding, feature-bloat, "everything visible"       | The opposite of focus. Every tool visible = nothing feels important.                                       |
| **Evernote**                   | Rich text chaos, inconsistent formatting, feature graveyard | Jack of all trades, master of none. Notes app + task manager + web clipper + scanner = nothing works well. |
| **Typical SaaS landing pages** | Gradient hero, 3-column icon grid, testimonial carousel     | Template design. Zero personality. Visitors bounce in 0.5s.                                                |

### Bravery Budget

OpenNotes is at **Characterful** register. These are the boldest choices:

| #   | Choice                                                                                           | Risk                                                      | Reward                                                                       | Evidence                                                                 |
| --- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | **No toolbar. Just the editor.** Tools appear only when summoned (slash, Cmd+K).                 | New users won't know what's possible.                     | Focused writers stay in flow. The surface is calm.                           | Primary archetype: "I don't want to think about the editor."             |
| 2   | **No signup. No email. No account.** Open the app and start writing. Your files in your browser. | No growth loop. No email capture. No retention analytics. | Frictionless. Radical trust. Differentiating in a world of "Sign in with X." | Research: "Users want to start immediately, not create another account." |
| 3   | **Green as the brand color.** Not blue. Not gray. #16a34a — vibrant, alive.                      | Could feel "off" to users who expect blue = tech product. | Distinctive. Any screenshot is instantly recognizable.                       | Swap test: if it were blue, it would look like every other tool.         |

**Fallback for #3:** If user testing shows green reduces trust, we can shift to a muted green (sage) or a deep navy blue. But we start with conviction and validate.

### Decision Framework

When evaluating a feature or design change, ask in this order:

1. **Does this serve the Focused Writer?** (No = kill)
2. **Can this be done without adding UI chrome?** (No = question it hard)
3. **Does this work when the user is offline?** (No = must degrade gracefully)
4. **Can a user reverse this action?** (No = must warn explicitly)
5. **Does this require a server we maintain?** (Yes = kill, violates core principle)

**Sixth question:** "Is this the safe choice or the right choice? If they're different, justify safety."

---

**Quality gates:**

- [x] Thesis is one sentence
- [x] Phase 1 is specific and shippable (matching plan.md)
- [x] Quality bar covers research through metrics, not just visuals
- [x] Bravery budget has 3 entries (Characterful register = 2-3)
- [x] Design debt tracked with intention to review monthly
