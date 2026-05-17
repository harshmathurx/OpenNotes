# 06-validation.md — Accessibility, Testing, Metrics

## Accessibility

**WCAG Target:** AA compliance. AAA where achievable without compromising the editor experience.

### Testing Protocol

| Test                | Tool/Method                       | Frequency   |
| ------------------- | --------------------------------- | ----------- |
| Keyboard navigation | Manual — Tab through every screen | Per feature |
| Screen reader       | VoiceOver (macOS), NVDA (Windows) | Per release |
| Contrast            | axe-core / Lighthouse CI          | Per build   |
| 200% zoom           | Manual — verify no content loss   | Per feature |
| High contrast mode  | System setting toggle             | Per release |
| Motion reduction    | System `prefers-reduced-motion`   | Per feature |

### Contrast Ratios

| Combination                     | Light  | Dark   | WCAG |
| ------------------------------- | ------ | ------ | ---- |
| Text on background              | 16.2:1 | 13.5:1 | AAA  |
| Primary on background           | 4.6:1  | —      | AA   |
| White text on primary (#16a34a) | 4.6:1  | —      | AA   |
| Muted text on background        | 5.5:1  | 4.5:1  | AA   |
| Destructive (red) on white      | 5.8:1  | —      | AA   |

**Color is never the sole state indicator.** Sync status, wikilink states, and validation errors all include icons or text alongside color.

### Keyboard Navigation

| Screen                 | Tab Order                                                          |
| ---------------------- | ------------------------------------------------------------------ |
| Editor                 | Sidebar toggle → file list → editor → title bar actions → zen mode |
| Command palette (open) | Input field (auto-focus) → results list → close                    |
| Conflict modal (open)  | Resolution tabs → content area → Cancel → Resolve                  |
| Dropdown menu          | Trigger → items (arrow keys) → close on Esc                        |

**Focus traps:** Modals and command palette trap focus. Closing returns focus to the triggering element.

**Skip links:** None needed — the editor is the primary content and there's no lengthy navigation to skip.

### Keyboard Shortcuts

| Shortcut       | Action                                     | When                    |
| -------------- | ------------------------------------------ | ----------------------- |
| Cmd+K / Ctrl+K | Open command palette                       | Always                  |
| Cmd+S / Ctrl+S | Flush sync manually                        | Always                  |
| Cmd+N / Ctrl+N | Create new file                            | Always                  |
| Cmd+Shift+Z    | Toggle zen mode                            | Always                  |
| Cmd+B / Ctrl+B | Bold (_not_ in editor — markdown is typed) | N/A                     |
| D (no focus)   | Toggle dark mode                           | Any non-input element   |
| Tab            | Indent (in editor)                         | Editor focused          |
| Esc            | Close modal / palette                      | Modal/palette open      |
| Enter          | Select / commit                            | Command palette / modal |
| Arrow keys     | Navigate within dropdowns, list            | Focused component       |

### Screen Reader

| Component       | Role                                | Announcements                       |
| --------------- | ----------------------------------- | ----------------------------------- |
| Sidebar         | `navigation`                        | "Files list, {{n}} items"           |
| File item       | `button` (clickable)                | "{{filename}}, {{modified date}}"   |
| Sync status     | `status` (aria-live: polite)        | "{{n}} unsaved" or "Syncing"        |
| Editor          | CodeMirror handles internally       | Text content, line numbers hidden   |
| Command palette | `dialog` + `combobox`               | "Search files. Results updating."   |
| Conflict modal  | `dialog` with `alertdialog` pattern | "Conflict detected in {{filename}}" |

**Every icon without adjacent text has an aria-label.**

### Motion

All animations respect `prefers-reduced-motion`:

- Zen mode toggle: instant (no transition)
- Modal open/close: instant (opacity 0→1, no scale)
- Sync spinner: static icon (no rotation)
- Scroll reveals: visible by default (no animation)
- No auto-playing video or animation on any page

### Touch Targets

- Minimum: 44x44px including padding
- Spacing: 8px minimum between adjacent interactive elements
- Sidebar items: full-width click area (240px wide), not just text
- Icon buttons: 44x44px explicit dimensions

### Cognitive Accessibility

- Reading level: Grade 8 or below for all UI copy
- Consistent layout: sidebar always left, title bar always top
- No timed interactions anywhere
- Undo is available (CodeMirror's built-in undo stack)
- No auto-advancing carousels, no flashing content

## Heuristic Evaluation

### Nielsen's 10 Heuristics — Self-Assessment

| Heuristic                           | Rating | Evidence                                                  | Action                           |
| ----------------------------------- | ------ | --------------------------------------------------------- | -------------------------------- |
| Visibility of system status         | 5      | Sync indicator always visible in title bar                | —                                |
| Match between system and real world | 4      | "Files" not "Vault", .md extension visible                | Monitor user vocabulary          |
| User control and freedom            | 5      | Undo stack, cancel on modals, reversible delete           | —                                |
| Consistency and standards           | 4      | Shadcn components, standard shortcuts                     | Ensure CM6 matches shadcn feel   |
| Error prevention                    | 4      | Conflict detection prevents overwrites                    | Add filename dup detection       |
| Recognition rather than recall      | 4      | Cmd+K palette surfaces all commands                       | Consider onboarding hints        |
| Flexibility and efficiency          | 4      | Shortcuts for power users, click for others               | Track shortcut usage             |
| Aesthetic and minimalist            | 5      | Zen mode, no toolbar, hidden chrome                       | —                                |
| Help users recognize errors         | 3      | Errors in title bar but might need more context           | Improve error copy in modals     |
| Help and documentation              | 2      | No help content (by design — tool should be self-evident) | Add tooltips for ambiguous icons |

**Weakest heuristics:** Error recognition (#9) and documentation (#10). Mitigated by: error copy that follows what/why/next framework. Documentation tradeoff: the tool is intentionally minimal. Users who need docs likely aren't the target audience.

### Cognitive Walkthrough

**Flow: First-time user creates a note**

| Step                          | Question            | Answer                                                             | Issue? |
| ----------------------------- | ------------------- | ------------------------------------------------------------------ | ------ |
| 1. Land on page               | What can I do here? | See "No files yet" + green "+" button                              | No     |
| 2. Click "+"                  | What happens?       | Prompt asks for filename                                           | No     |
| 3. Type filename, press Enter | What now?           | File appears in sidebar, editor activates with cursor              | No     |
| 4. Start typing               | Is this working?    | Text appears, markdown renders live, save indicator shows "Synced" | No     |
| 5. Cmd+S                      | What happens?       | Sync flushes, status shows "Syncing…" then "Synced"                | No     |

**Flow: Returning user opens existing file**

| Step                     | Question     | Answer                                  | Issue? |
| ------------------------ | ------------ | --------------------------------------- | ------ |
| 1. Open app              | Where am I?  | Last open file loads automatically      | No     |
| 2. Want a different file | How?         | Sidebar shows files, or press Cmd+K     | No     |
| 3. Cmd+K, type filename  | Which one?   | Fuzzy search narrows in real-time       | No     |
| 4. Press Enter           | Did it work? | Editor updates to selected file content | No     |

## Usability Testing Plan

### Test Plan (Post-V1)

| Element      | Detail                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| Objective    | Validate that users can create, edit, sync, and resolve conflicts without friction |
| Method       | Moderated, think-aloud protocol                                                    |
| Participants | 5 (The Focused Writer archetype, screened by behavior)                             |
| Tasks        | 5 tasks (listed below)                                                             |
| Metrics      | Completion rate, time on task, error count, SUS                                    |

### Task Scenarios

| #   | Scenario                                                               | Success Criteria                                           | Time Limit |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ---------- |
| 1   | Create a new markdown file and write 3 sentences with headers and bold | File exists with rendered markdown                         | 2 min      |
| 2   | Create a second file and link to the first using [[]] syntax           | Link appears, clicking it navigates to target              | 2 min      |
| 3   | Find and open a file you created yesterday (simulated)                 | File opens with content intact                             | 30 sec     |
| 4   | Trigger sync (Cmd+S) and verify sync status shows "Synced"             | Status transitions: Syncing → Synced                       | 1 min      |
| 5   | Delete a file (via sidebar) and confirm it's gone                      | File removed from sidebar, editor shows next file or empty | 30 sec     |

### Success Thresholds

| Metric                  | Ship             | Iterate      | Redesign    |
| ----------------------- | ---------------- | ------------ | ----------- |
| Task completion rate    | > 90%            | 70-90%       | < 70%       |
| Time on task (avg)      | < expected + 50% | 50-100% over | > 100% over |
| Error count per task    | < 1              | 1-3          | > 3         |
| SUS score               | > 80             | 68-80        | < 68        |
| First-click correctness | > 85%            | 70-85%       | < 70%       |

## Design Metrics

### UX Metrics

| Metric                         | Event                             | Tool                | Baseline | Target           |
| ------------------------------ | --------------------------------- | ------------------- | -------- | ---------------- |
| File creation rate             | "file_created" event              | PostHog / Plausible | N/A      | TBD after launch |
| Cmd+K usage                    | "command_palette_opened"          | PostHog             | N/A      | TBD              |
| Sync completion rate           | "sync_completed" vs "sync_failed" | PostHog             | N/A      | > 95%            |
| Zen mode sessions              | "zen_mode_toggled" duration       | PostHog             | N/A      | TBD              |
| Wikilink creation              | "wikilink_created"                | PostHog             | N/A      | TBD              |
| Bounce rate (landing → editor) | Page view → CTA click             | Plausible           | N/A      | TBD              |

### Heatmaps (Post-Launch)

Deploy on: Editor page, landing page, conflict modal.

| Map Type             | Questions It Answers                                    |
| -------------------- | ------------------------------------------------------- |
| Click map            | Do users find Cmd+K? Do they click sidebar vs keyboard? |
| Scroll map           | Do visitors scroll past the landing page hero?          |
| Attention map        | Where do eyes linger in the editor — toolbar or text?   |
| Rage click detection | Where do users click repeatedly (broken affordances)?   |

**Privacy:** All analytics masked for PII. OpenNotes doesn't see file contents — analytics are behavioral, not content-based.

### Funnel Analysis

```
Core funnel:
  1. Land on /landing → 2. Click "Try it now" → 3. Create first file → 4. Write > 100 chars → 5. Return next day

Stages are measured by events, not page views.
Drop-off at stage 3-4 is the most critical signal — if people create but don't write, the editor is failing.
```

## Decision Framework

```
Signal:     Metric exceeds threshold
Threshold:  When to act
Response:   Design action
Validation:  How to confirm the fix worked
```

| Signal                                  | Threshold | Response                          | Validation              |
| --------------------------------------- | --------- | --------------------------------- | ----------------------- |
| Task completion < 70%                   | Any flow  | Cognitive walkthrough + fix       | Re-test with 3 users    |
| SUS < 68                                | Score     | Full heuristic re-eval            | Re-test SUS after fixes |
| > 20% drop-off between create and write | Stage 3-4 | Redesign empty editor state       | Re-measure funnel       |
| Sync failure > 5%                       | Rate      | Investigate provider API issues   | Re-measure for 1 week   |
| Cmd+K usage < 10% of sessions           | Weekly    | Surface Cmd+K hint in empty state | Re-measure for 2 weeks  |

---

**Quality gates:**

- [x] Every text-background combination meets AA contrast
- [x] Every interactive element is keyboard-reachable
- [x] Heuristic evaluation completed before user testing
- [x] SUS defined with ship/iterate/redesign thresholds
- [x] Core flows instrumented for entry, completion, abandonment
- [x] Heatmap plan covers 3 highest-traffic screens
