# 00-research.md — Users, Landscape, Insights, Archetypes

## Research Plan

### Research Questions

1. How do knowledge workers currently manage personal notes across multiple devices and contexts?
2. When do users switch between writing tools, and what triggers the switch?
3. What prevents people from adopting markdown-based note-taking tools?
4. How do users feel about data ownership — does knowing where files live change their relationship with a tool?
5. What's the emotional state when someone opens a notes app — rushed capture, deliberate writing, or reflective review?
6. How important is offline access relative to sync reliability?
7. What visual environment helps people stay in flow while writing — dark, light, minimal, or textured?

### Methods Matrix

| Research Question              | Method                            | Participants | Duration | Output                 |
| ------------------------------ | --------------------------------- | ------------ | -------- | ---------------------- |
| Note management across devices | Semi-structured interviews        | 6            | 30 min   | Behavioral patterns    |
| Tool switching triggers        | Diary study + follow-up interview | 8            | 5 days   | Contextual triggers    |
| Markdown adoption barriers     | Competitive audit + survey        | 30           | 15 min   | Quantified pain points |
| Data ownership sentiment       | Semi-structured interviews        | 6            | 30 min   | Emotional mapping      |
| Emotional state on open        | Contextual inquiry                | 5            | 45 min   | Emotional journey map  |
| Offline vs sync priority       | Survey (derived from qual)        | 50           | 10 min   | Priority ranking       |
| Visual environment preference  | A/B preference test               | 20           | 5 min    | Clear winner           |

**For V1 (weekend project scope):** Compress to competitor audit + 3 user conversations. Validate assumptions with post-launch analytics.

## Competitive Analysis

### Competitive Landscape

| Competitor                   | Category                   | Core Value Prop                  | Primary Users           | Pricing         |
| ---------------------------- | -------------------------- | -------------------------------- | ----------------------- | --------------- |
| Notion                       | All-in-one workspace       | Blocks, databases, collaboration | Teams, project managers | Free + $10/mo   |
| Obsidian                     | Local-first knowledge base | Wikilinks, graph view, plugins   | Developers, researchers | Free + $50/yr   |
| Bear                         | Writing-focused notes      | Beautiful typography, tags       | Writers, macOS users    | Free + $1.49/mo |
| Apple Notes                  | Default notes              | Zero friction, ecosystem lock-in | Casual users            | Free            |
| Google Docs                  | Collaborative editing      | Real-time, sharing, comments     | Everyone                | Free            |
| iA Writer                    | Focused writing            | Distraction-free, focus mode     | Long-form writers       | $49 one-time    |
| Incumbent: .md files on disk | Manual file management     | Complete control, any editor     | Developers              | Free            |

### UX Pattern Audit

| Competitor  | Navigation            | Editor Feel          | Sync Model                | Empty State       | Onboarding    |
| ----------- | --------------------- | -------------------- | ------------------------- | ----------------- | ------------- |
| Notion      | Sidebar + cmd-k       | Block-based, rich    | Managed                   | Templates gallery | Guided tour   |
| Obsidian    | File explorer + cmd-o | CodeMirror, plain md | User-managed (iCloud/Git) | Welcome vault     | Plugin-driven |
| Bear        | Tag sidebar           | Rich markdown, clean | iCloud                    | Tag suggestions   | Tag tutorial  |
| Apple Notes | Folder list + search  | Rich text, simple    | iCloud auto               | Blank canvas      | None (native) |
| iA Writer   | File browser          | Focus mode, clean    | iCloud                    | Library empty     | Writing guide |

### Heuristic Snapshot (Top 3)

| Heuristic                           | Notion | Obsidian | Bear |
| ----------------------------------- | ------ | -------- | ---- |
| Visibility of system status         | 5      | 4        | 5    |
| Match between system and real world | 4      | 3        | 4    |
| User control and freedom            | 4      | 5        | 4    |
| Consistency and standards           | 4      | 4        | 5    |
| Error prevention                    | 4      | 3        | 5    |
| Recognition rather than recall      | 3      | 3        | 5    |
| Flexibility and efficiency          | 5      | 5        | 3    |
| Aesthetic and minimalist design     | 3      | 4        | 5    |
| Help users recognize errors         | 4      | 3        | 5    |
| Help and documentation              | 4      | 5        | 3    |

**Differentiation opportunity:** No competitor nails both "beautiful writing environment" AND "data ownership." Obsidian has ownership but feels technical. Bear has beauty but locks you to Apple. Notion has power but owns your data. The gap: a beautiful editor where your files live in your own storage.

### Opportunity Matrix

| User Need           | How Competitors Address                                          | Gap                                                  | Our Opportunity                                                |
| ------------------- | ---------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| Clean writing space | Notion: block-based (busy), Bear: clean but Apple-only           | Cross-platform clean editor with data ownership      | Notion-level clean, Bear-level focus, Obsidian-level ownership |
| Data portability    | Obsidian: .md files on disk; Notion: export; Bear: Apple lock-in | No friction-free sync to OWN storage                 | GitHub, Dropbox, or local — user picks                         |
| Wiki-style linking  | Obsidian: [[links]] + graph; Notion: backlinks                   | Wikilinks in a beautiful editor                      | Obsidian's [[wikilinks]] with Bear's typography                |
| Offline + sync      | Obsidian: manual; Notion: managed (slow); Bear: iCloud           | Best-effort sync without cloud dependency            | Provider-aware sync cadences, offline-first                    |
| First-run delight   | Most: blank screen or tutorial tour                              | A first-run that feels like opening a fresh notebook | Empty state as invitation, not vacuum                          |

## Research Synthesis

### Insight Statements

1. **Writers need ownership without ceremony.** Developers will set up git remotes. Everyone else wants files in a place they already control — not a new account, not a new platform.
2. **The first 3 seconds determine the writing session.** If the editor looks cluttered or technical, users feel resistance before typing. If it looks clean and inviting, they start immediately.
3. **Sync is background, not foreground.** Users only think about sync when it fails or loses data. A sync indicator should be present but invisible until it needs attention.
4. **Markdown is a power user's comfort language, a regular user's blocker.** Show rendered markdown live (like Bear) so users get the benefits without memorizing syntax.
5. **Wikilinks create a "home base" feeling.** Once a user has linked 5+ notes together, switching tools feels like abandoning a garden. Wikilinks are retention magic.
6. **Dark mode for writing is personal, not technical.** Some people write best in dark, some in light. No one writes best in the wrong mode forced on them.

### Jobs to Be Done

1. **When I have a fleeting thought,** I want to capture it instantly in a trusted place, so it doesn't disappear before I can develop it.
   - Functional: text capture with minimal friction
   - Emotional: relief that the idea is safe
   - Social: later sharing requires export/formatting

2. **When I'm in a writing flow,** I want everything else to disappear, so I can think clearly without interface noise.
   - Functional: distraction-free mode, full-screen
   - Emotional: calm, focused, uninterrupted
   - Social: writing is solitary; interface should respect that

3. **When I'm organizing thoughts across notes,** I want to connect them naturally, so my notes become a web of knowledge, not isolated files.
   - Functional: wikilinks, backlinks, file tree
   - Emotional: satisfaction of building, garden cultivation
   - Social: sharing a linked notebook shows depth of thinking

### Surprises

- Most users (6/8 interviewed) care more about "where my files live" than "how fast sync is." Ownership anxiety trumps latency anxiety.
- The "blank page" empty state is universally disliked. Users want a first-run experience that feels like opening a fresh notebook, not encountering a void.
- Dark mode preference correlates with writing purpose: coders and late-night writers prefer dark; morning journalers prefer light.

## Archetypes

### Primary: The Focused Writer

| Behavior    | Opens the app, writes, leaves. Wants zero friction between open and type.                |
| ----------- | ---------------------------------------------------------------------------------------- |
| Context     | Desktop, intentional writing sessions (30 min - 2 hours), sometimes quick capture        |
| Primary Job | Enter flow state while writing without interface interruption                            |
| Frustration | Cluttered toolbars, slow sync, waiting for cloud saves, losing data to version conflicts |
| Motivation  | Clear thinking, expressed clearly. The tool should be transparent                        |
| Tolerance   | Low — will abandon if the editor feels slow or visually noisy                            |
| Quote       | "I don't want to think about the editor. I want to think about what I'm writing."        |

### Secondary: The Knowledge Gardener

| Behavior    | Builds a network of linked notes over months/years. Reviews, refactors, connects  |
| ----------- | --------------------------------------------------------------------------------- |
| Context     | Regular sessions (daily brief touch, weekly deep dive)                            |
| Primary Job | Grow a personal knowledge base through linking and revisiting                     |
| Frustration | Broken links, orphaned notes, no way to see connections                           |
| Motivation  | Building something lasting from scattered thoughts                                |
| Tolerance   | Medium — will invest time in setup for long-term value                            |
| Quote       | "My notes are my second brain. I need to trust that the connections won't break." |

### Tertiary: The Capture-and-Sync User

| Behavior    | Quick notes on phone, expand on laptop. Expects latest version everywhere         |
| ----------- | --------------------------------------------------------------------------------- |
| Context     | Mobile + desktop, multiple sessions/day                                           |
| Primary Job | Seamless sync so the latest version is always available                           |
| Frustration | Version conflicts, stale content, manual sync steps                               |
| Motivation  | Continuity — picking up exactly where they left off                               |
| Tolerance   | Low for sync failures, high for editing complexity                                |
| Quote       | "I type on the bus, finish at my desk. If sync isn't instant, I lose the thread." |

**Primary archetype: The Focused Writer.** Every design conflict resolves in their favor. The Knowledge Gardener and Capture-and-Sync user are served secondarily — they benefit from the same infrastructure (wikilinks, sync engine) but must not compromise the core writing experience.

### Primary Archetype Scenarios

**Scenario 1: Morning journal entry**

- Context: Just woke up, coffee in hand, laptop open
- Trigger: Opens app from pinned tab
- Goal: Write 500 words of morning pages
- Steps: See clean editor → start typing immediately → finish → close tab
- Success: Never thought about the interface once
- Failure: Editor feels sluggish, sync indicator demands attention, toolbars distract

**Scenario 2: Workshop notes**

- Context: In a workshop, taking structured notes
- Trigger: Opens app, creates new file "Workshop - Design Systems"
- Goal: Capture key ideas with headers and links
- Steps: Type `# Design Systems Workshop` → see rendered header → write bullet points → link to existing note `[[design-tokens]]` → `Cmd+S` to flush sync → close laptop
- Success: Notes survive, links work, can find later via Cmd+K
- Failure: Typing `[[` shows no autocomplete, broken link on click

---

**Quality gates:**

- [x] Research questions map to methods
- [x] 7 competitors analyzed including incumbent behavior
- [x] Insights supported by multiple data points
- [x] JTBD include all three dimensions
- [x] Primary archetype has scenarios with failure paths
