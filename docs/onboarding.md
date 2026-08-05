# OpenNotes — Onboarding Flow (Research + Design Spec)

> For the engineer implementing this: every string in Section 3 is final and paste-ready. Every decision in Section 2 is defended in Section 4. Edge cases in Section 5 are requirements, not suggestions. Do not invent new copy; if a state isn't covered here, ask.

---

## 1. Design principles (max 5)

1. **Writing comes before setup.** The fastest path to the first keystroke is the primary path. Everything else is an offer, never a gate.
2. **One decision per screen.** Each screen asks exactly one question. If a screen needs two answers, it's two screens.
3. **Describe what it means, not how it works.** Users choose outcomes ("my notes are real files I can see in Finder"), not mechanisms ("File System Access API via IndexedDB fallback").
4. **Every choice is reversible, and we say so.** The fear of picking wrong kills more onboarding than any missing feature. Each choice is labeled as changeable, because in this product it actually is.
5. **Local is a first-class home, not a waiting room.** Local-only is the product's promise (no account, no server), not a degraded demo. It is never framed as "limited," "temporary," or "just to try."

---

## 2. The exact flow

Four screens total. A user can be writing within **one click** of Screen 0, and never more than three decisions deep on the longest path.

```
Screen 0 (Welcome)
 ├── "Start writing" ──────────────► create first note → editor (done, flag set)
 └── "Set up how you work" ────────► Screen 1 (Choose your setup)
                                        ├── Keep it in this browser ──► Screen 2a (confirm) ──► Screen 3
                                        ├── A folder on this Mac ─────► native picker ─► Screen 2b (preview) ─► Screen 3
                                        └── Folder + git sync ────────► native picker ─► Screen 2c (git explainer) ─► Screen 3
Screen 3 (You're in) ──► editor with first note open
```

### Screen 0 — Welcome

**Purpose:** Answer "what is this?" in one sentence, and offer the two honest doors: write now, or choose your setup.

**Wireframe in words:**
- Full-screen, centered column, max-width ~480px, generous vertical whitespace. Background is the app's plain `bg-background` — no illustration, no gradient hero, no logo animation. The calm *is* the visual.
- A single small icon (the existing `FileText` mark in a muted rounded square, same as today's empty state) sits above the headline. Quiet, not celebratory.
- Headline: what OpenNotes is, one sentence.
- One supporting line: the trust promise (no account, no server, saved on this device).
- Two actions, stacked:
  - **"Start writing"** — primary button, visually dominant. This is the default (see Section 4.1). Creates the first note and lands in the editor. Skips all setup; setup remains reachable forever via Settings and the command palette.
  - **"Set up how you work"** — secondary (outline/ghost) button. Advances to Screen 1.
- A one-line caption under the buttons in `text-xs` muted: reassurance that the choice isn't final.

**Why two buttons and not a single funnel:** a forced multi-step wizard before value is the classic onboarding failure. A user who just wants to type should never touch a setup screen. But a user landing *knowing* they want files-on-disk shouldn't have to discover the folder picker buried in a palette later — they get a dignified, explicit door.

### Screen 1 — Choose your setup

**Purpose:** One question — where should your notes live? Three cards, one decision.

**Wireframe in words:**
- Same centered column layout, slightly wider (~640px) to fit three cards on desktop; cards stack vertically on narrow viewports.
- Headline asks the question; a subline states the reversal promise once, globally, instead of repeating it on each card.
- Three selectable cards (radio semantics: one must be selected; exactly one is pre-selected):
  1. **Keep it in this browser** — *pre-selected default.* Works instantly, everywhere, including this web app.
  2. **A folder on this Mac** — marked "Mac app" with a small, quiet badge. On web, also marked with an honest availability note (Section 5.4).
  3. **A folder with git sync** — also Mac-badged. Framed as the folder option *plus* version history and sync, not as a separate universe.
- Each card: title, one line of what it *means*, one line of who it's for. No technical nouns (no IndexedDB, no File System Access API, no SSH).
- One primary button at the bottom: "Continue". A text-button "Back" returns to Screen 0.
- The "you can change this anytime" line appears once under the cards, applying to all three — calmer than three identical disclaimers.

**Card titles and one-liners (final copy in Section 3):**
- *Keep it in this browser* → your notes live in this browser, on this device. Private by default.
- *A folder on this Mac* → your notes are real files you can see, search, and back up.
- *A folder with git sync* → the same folder, plus history and a remote you control.

### Screen 2 — Per-path configuration

One screen per path, shown only for the chosen card. Each does the minimum needed to make the choice real, then gets out of the way.

#### Screen 2a — Local (confirm + go)

**Wireframe:** Headline confirms the choice in past tense ("Your notes stay in this browser"). Two short lines: what that means day to day (saves as you type, works offline) and the one honest caveat (clearing this browser's site data clears them — phrased as advice, not a warning). One primary button: "Start writing". That's the whole screen. No toggles, no checkboxes, nothing to configure — because there is genuinely nothing to configure.

#### Screen 2b — Folder (native pick + preview)

**Wireframe:** Headline says what will happen. A single primary button — "Choose a folder" — triggers the **existing `pickNotesFolder()`** (native picker in the Mac app). No in-app directory tree, no path text field.
- **After a successful pick**, the screen updates in place to a preview state: a quiet confirmation line — "Your notes will live in:" — followed by the chosen path in a muted monospace chip, and the folder name in a friendlier line above it. Primary button becomes "Continue".
- **If the picker is cancelled**, the screen stays exactly as it was. No error, no toast, no modal — cancelling a picker is a neutral act, not a failure (matches existing behavior in `useNotesFolderActions`, which stays silent on cancel).
- A "Back" text-button returns to Screen 1 with no side effects (nothing was written).

#### Screen 2c — Folder + git sync (pick + one-screen explainer)

**Wireframe:** Top half is identical to 2b: "Choose a folder" → native picker → path preview after pick.
Bottom half is a calm explainer block, always visible, titled "How sync works here". Three short lines, no diagram:
- It uses the git already on your Mac.
- Your existing sign-in is used — OpenNotes never asks for or stores a password or token.
- You connect a remote (like GitHub) later, from the Git Sync panel, whenever you're ready.
Primary button after a folder is picked: "Continue". **No git init, no remote form, no credential anything inside onboarding** (rationale in Section 4.3). The explainer's last line names exactly where the rest of the work happens, so the user knows the loop is closed later, not dropped.

### Screen 3 — You're in

**Purpose:** Close the loop with confidence, teach three things that matter in the first five minutes, and land somewhere useful.

**Wireframe in words:**
- Headline: "You're all set." One warm line underneath that reflects *their chosen path* (three variants, Section 3) — this is the only screen whose copy adapts to the choice, because confirmation is where personalization pays and everywhere else it's noise.
- "Three things to know" — a compact vertical list with three rows, each an icon + one line:
  1. **Just write.** Everything saves as you type.
  2. **Cmd+K is your map.** Every note and every action lives there.
  3. **Make it yours.** Fonts and layout are in Settings, whenever you want them.
- One optional fourth line, visually quieter (muted, smaller): the AI Co-Writer pointer — opt-in, your own key or fully local, find it in Settings. One line, no setup, no button. It exists here so users discover it; it's quiet so it never reads as an upsell.
- Primary button: **"Open your first note"** (Mac/folder paths) or **"Start writing"** (local path) — see Section 4.5.
- **Landing target: the editor, with a fresh first note already created and focused** — not Workspace Home. Rationale in Section 4.5.

---

## 3. Copy deck (final, paste-ready)

Voice rules enforced throughout: no "vault", no "sync to the cloud", no "unlock", no "supercharge", no exclamation marks, no emojis, no jargon. Cmd is written "Cmd" (the Mac app is the primary target; on web the existing UI already shows "Ctrl" variants — follow that platform convention where the app already does).

### Screen 0 — Welcome

| Element | Final string |
|---|---|
| Headline | `OpenNotes is a calm place to write, where your notes stay yours.` |
| Subline | `No account. No server. Everything saves on this device.` |
| Primary button | `Start writing` |
| Secondary button | `Set up how you work` |
| Caption under buttons | `You can change how your notes are stored at any time.` |

### Screen 1 — Choose your setup

| Element | Final string |
|---|---|
| Headline | `Where should your notes live?` |
| Subline | `Pick what fits today — you can change your mind later, and your notes come with you.` |
| Card 1 title | `Keep it in this browser` |
| Card 1 body | `Your notes are saved privately in this browser, on this device. Works offline, starts instantly.` |
| Card 1 "for" line | `The simplest way to begin.` |
| Card 2 title | `A folder on this Mac` |
| Card 2 badge | `Mac app` |
| Card 2 body | `Your notes become real files in a folder you pick — easy to search, back up, and open anywhere.` |
| Card 2 "for" line | `For notes you'll keep for years.` |
| Card 3 title | `A folder with git sync` |
| Card 3 badge | `Mac app` |
| Card 3 body | `The same folder, plus a full history of every change, synced to a remote you control.` |
| Card 3 "for" line | `For writers who already use git.` |
| Shared reassurance line (under cards) | `Whichever you choose, your notes stay readable, portable, and yours.` |
| Primary button | `Continue` |
| Back | `Back` |

### Screen 2a — Local confirm

| Element | Final string |
|---|---|
| Headline | `Your notes stay in this browser.` |
| Body line 1 | `They save as you type and work offline — no sign-in, no setup.` |
| Body line 2 | `One thing to know: clearing this browser's site data clears them. If a note ever becomes precious, move it to a folder from Settings.` |
| Primary button | `Start writing` |
| Back | `Back` |

### Screen 2b — Folder

| Element | Final string |
|---|---|
| Headline | `Pick a home for your notes.` |
| Body | `Choose any folder. OpenNotes will keep your notes there as plain files you can open in any editor.` |
| Primary button (before pick) | `Choose a folder` |
| After-pick label | `Your notes will live in:` |
| After-pick path chip | `<full chosen path>` (monospace, truncated middle if long) |
| After-pick friendly line | `Notes in <folder name> are yours — searchable, backable, portable.` |
| Primary button (after pick) | `Continue` |
| Back | `Back` |

### Screen 2c — Folder + git sync

| Element | Final string |
|---|---|
| Headline | `Pick a folder, then let git watch over it.` |
| Body | `Choose any folder. Your notes live there as plain files, and git keeps a history of every change.` |
| Primary button (before pick) | `Choose a folder` |
| After-pick label | `Your notes will live in:` |
| After-pick path chip | `<full chosen path>` |
| Explainer title | `How sync works here` |
| Explainer line 1 | `OpenNotes uses the git already on your Mac — the same one your code uses.` |
| Explainer line 2 | `It signs in with what you already have. You're never asked for a password or token.` |
| Explainer line 3 | `Connect a remote like GitHub later, from the Git Sync panel, whenever you're ready.` |
| Primary button (after pick) | `Continue` |
| Back | `Back` |

### Screen 3 — You're in

| Element | Final string |
|---|---|
| Headline | `You're all set.` |
| Path line — local | `Your notes are saving in this browser, right now.` |
| Path line — folder | `Your notes are real files in <folder name>, right now.` |
| Path line — git | `Your notes are real files in <folder name>. When you want history and sync, open the Git Sync panel.` |
| List item 1 | `Just write — everything saves as you type.` |
| List item 2 | `Press Cmd+K for your map — every note and every action lives there.` |
| List item 3 | `Make it yours — fonts and layout are in Settings, whenever you want them.` |
| AI pointer (quiet line) | `Curious later? The AI Co-Writer is opt-in and runs on your own key — or fully on this Mac. Find it in Settings.` |
| Primary button (local path) | `Start writing` |
| Primary button (folder/git paths) | `Open your first note` |

### Toasts (existing patterns, reused)

| Moment | Final string |
|---|---|
| Folder picked (from onboarding) | reuse existing: `Opened <folder name>` |
| Web user attempts folder pick | reuse existing: `Opening folders works best in the OpenNotes Mac app` |

---

## 4. Decision rationale

### 4.1 "Start writing" is the primary/default on Screen 0
The product's own north star says "first run → type immediately," and the strongest thing OpenNotes can show a skeptic is itself. A user who types one sentence and watches it save has learned more than any wizard could teach. Setup is offered as an equally dignified door — not hidden — because the folder-committed user deserves a direct path too.

### 4.2 Local is the pre-selected card, and it never reads as lesser
Pre-selecting the option that works on every platform, requires zero configuration, and embodies the product's promise (private, instant, no account) is honest product design, not dark-pattern steering. The copy deliberately frames local in terms of what it *has* ("private by default," "the simplest way to begin") rather than what it lacks — there is no "just", no "only", no "for now" anywhere near it. The folder options are framed as additions ("real files," "plus history"), never as upgrades from a deficient state.

### 4.3 Git setup is deferred to the Git Sync panel
Onboarding's job is to establish where notes live and build trust; git's job (init, remotes, identity, SSH/agent state) is a workflow with real failure modes that deserves a real home — and that home already exists as the Git Sync panel, with honest empty states ("This folder isn't a git repository yet," "Add a remote") built for exactly this. Cramming even a "light" version into a wizard would duplicate the panel, double the failure surface, and stall users at the exact moment momentum matters most. The explainer screen closes the loop by naming *where* and *when* the rest happens, so nothing feels dropped.

### 4.4 Skip is always allowed, and there is no "are you sure?"
"Start writing" on Screen 0 *is* the skip — present on the very first screen, not hidden behind a "Skip" link in a corner. Once past Screen 0, "Back" never punishes: nothing is written until a folder is actually picked, and even then, switching back costs nothing because the folder choice is changeable from Settings forever. Confidence comes from reversibility, not from confirmation dialogs.

### 4.5 Land in the editor with a first note, not Workspace Home
The editor *is* the product; the Home is a habit that forms later. Landing on a blank-but-focused first note converts onboarding momentum directly into the core loop (write → save → trust). Workspace Home is one Cmd+Shift+H away and is genuinely more useful once notes exist to be "recent." The button label differs by path ("Start writing" vs "Open your first note") only to stay truthful about what clicking does — the destination is the same.

### 4.6 Web vs Mac: one flow, honest constraints
The flow is identical on both platforms; only capability differs. On web, the folder cards stay visible (they explain the product's shape) but carry the "Mac app" badge, and choosing one triggers the existing honest toast — "Opening folders works best in the OpenNotes Mac app" — rather than a fake picker or a bait-and-switch. This teaches the web→Mac story at the exact moment the user expressed the need, which is the most credible cross-sell the product has.

---

## 5. States and edge cases

### 5.1 First run ever
Gate: `localStorage["opennotes-onboarding-complete"]` is unset **and** `files.length === 0`. Show `OnboardingFlow` full-screen, replacing the current `AppShell` empty state. The existing empty state remains as the fallback for any session where onboarding is complete but the vault is empty (e.g., user cleared their folder).

### 5.2 Returning user
Once `"opennotes-onboarding-complete": "true"` is written, onboarding never renders again — including after updates, folder switches, or storage-provider changes. There is no "replay onboarding" entry point in v1; Settings covers every choice the flow makes. (If a replay is ever wanted, add a Settings row that simply deletes the key — do not build a second copy of the flow.)

### 5.3 User picks a folder, then cancels the native picker
`pickNotesFolder()` returns `null` and already stays silent. The screen remains in its pre-pick state ("Choose a folder" button, explainer intact). No error UI, no toast, no state mutation, no analytics (there are none). Repeated cancel → pick cycles must be harmless.

### 5.4 Web user chooses a folder option
On web (`!isTauri()`), cards 2 and 3 remain selectable — hiding them would teach nothing — but selecting either and continuing triggers the existing toast "Opening folders works best in the OpenNotes Mac app" and leaves the user on the same screen. Secondary quiet line appears under the chosen card at that moment: `Your notes are safe in this browser either way.` (mirrors the Git Sync panel's reassurance tone). The user can then pick card 1 or go back — never stranded.

### 5.5 Reduced motion
Respect `prefers-reduced-motion`: all screen transitions become instant opacity cuts (no slide, no scale). This flow has no animation beyond simple fades by design; if any are added, they must be behind a `useReducedMotion` check.

### 5.6 Keyboard navigation
Full operability without a pointer: Tab order follows visual order (Screen 0: Start writing → Set up how you work). Screen 1 cards are a real `radiogroup` with arrow-key selection and Enter/Space to confirm; "Continue" and "Back" are reachable by Tab. Enter activates the primary button on every screen. Escape acts as "Back" on Screens 1–3 and does nothing destructive on Screen 0. Focus moves to the screen headline on every transition (`tabIndex={-1}` + `.focus()`), so screen-reader and keyboard users never lose their place.

### 5.7 Closing mid-flow
- **Screen 0, closed untouched:** nothing persisted; onboarding shows next launch. Correct — no choice was made.
- **Screen 1–2, closed:** nothing persisted (no folder was adopted, or a pick is re-readable from `getNotesFolder()`); onboarding shows next launch at Screen 0. Acceptable and simple.
- **Folder picked, then closed before finishing:** the folder choice itself already persisted via `setNotesFolder()` (that's the existing, correct behavior — the vault follows the folder). On next launch, onboarding restarts at Screen 0, but the user's folder is intact; finishing the flow or pressing "Start writing" writes the flag. No special-casing needed.
- **The flag is written exactly once, at one moment:** when the user presses the final button on Screen 3 (any path), or presses "Start writing" on Screen 0. Never earlier — completing setup is what completes onboarding, not viewing it.

### 5.8 First-note creation
For "Start writing" (Screen 0 and local path): call the existing `createFile()` and land in the editor — identical to today's "Create first note" button. For folder paths: same `createFile()` after the folder is adopted, so the first file lands in the picked folder. If file creation fails, show the existing empty state rather than trapping the user in onboarding — the flag is still written, because setup itself succeeded.

---

## 6. Implementation notes for the engineer

### 6.1 Where it lives
- New component: `components/onboarding/OnboardingFlow.tsx` — full-screen (`h-screen`, `bg-background`), rendered **inside `AppShell` before the existing first-run empty-state branch**.
- Gate (in `AppShell`, ahead of the `files.length === 0` return):
  ```ts
  const [onboarded, setOnboarded] = useState<boolean>(
    () => localStorage.getItem("opennotes-onboarding-complete") === "true"
  )
  if (!onboarded && files.length === 0) {
    return <OnboardingFlow onComplete={() => setOnboarded(true)} />
  }
  ```
- The existing empty state stays untouched beneath this gate; it remains the post-onboarding empty state.
- Keep the flow self-contained: it needs `pickNotesFolder` (from `useNotesFolderActions`), `createFile` (already in `AppShell` via `useVault` — pass down as a prop), and `isTauri()` from `@/core/bridge/runtime`. No new hooks, no new state management library.

### 6.2 Persisted state
- **Completion flag:** `localStorage["opennotes-onboarding-complete"] = "true"`. Single key, string `"true"`, consistent with existing keys like `opennotes-dashboard-scratch`. Written once, at the moments defined in 5.7.
- **Chosen path (optional, for Screen 3 copy variant):** `localStorage["opennotes-onboarding-path"] = "local" | "folder" | "git"`. Optional because the same info is derivable from `getNotesFolder()`, but the explicit key makes the Screen 3 line trivial and survives a user who picked a folder and later cleared it. Do not persist anything else — no step index, no timestamps, no funnel metrics (zero telemetry is a non-negotiable).
- The notes folder itself is already persisted by the existing `setNotesFolder()` — onboarding must not duplicate that.

### 6.3 Choice → real product action mapping
| Onboarding choice | Real action |
|---|---|
| Keep it in this browser | Nothing to call. Proceed: write flag, `createFile()`, land in editor. The vault already defaults to IndexedDB. |
| A folder on this Mac | Call existing `pickNotesFolder()` from `useNotesFolderActions`. On non-null return, show the preview state with the returned path. `useVault` reconciles automatically via `onNotesFolderChange` — do not touch the vault. |
| Folder + git sync | Identical to folder: `pickNotesFolder()` → preview. No git calls in onboarding. After Screen 3, land in the editor; the user opens the Git Sync panel (id `git-sync`) from the panel host or command palette when ready. Optionally, on this path only, open the Git Sync panel once after landing via the existing panel mechanism (`setActivePanelId("git-sync")` + `persistActivePanel`) — acceptable but not required; the Screen 3 copy already points there. |
| AI Co-Writer | No action. Mention-only on Screen 3; setup stays in the existing `AIOptionsDialog` reachable from Settings. |

### 6.4 Do NOT
- Do not modify `useNotesFolderActions`, `useVault`, or the git-sync extension — the flow consumes them as-is.
- Do not add analytics, step tracking, or a "skip" counter.
- Do not reuse the word "vault" anywhere in UI copy, even though the code does.
- Do not remove the existing empty-state UI in `AppShell` — it is the correct fallback after onboarding.
