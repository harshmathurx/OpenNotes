# 01-structure.md — Flows, IA, Navigation, Content, Wireframes

## User Flows

### Task Analysis: Writing a new note

```
Job: When I have an idea, I want to capture it in a clean space so I can think clearly.

Tasks:
  1. Open OpenNotes → Decision? Y → If from blank: create new. If continuing: open last file.
  2. Enter title / first line → No decision
  3. Write content → No decision
  4. (Optional) Insert wikilink → Decision? Y → Search existing files or create new
  5. Save → Error possible? Y → If offline: queue sync. If conflict: surface resolution.
```

### Core Flow: First Visit → First Note → Saved

```
Trigger:    Lands on / (or /landing if not ready to commit)
Archetype:  The Focused Writer
Happy path: 7 steps, ~30 seconds

Step 1: See empty canvas with "Untitled" in title bar
Step 2: Click "New file" button or press Cmd+N
Step 3: Type filename, press Enter
Step 4: Editor activates, cursor blinks at position 1
Step 5: Type markdown — headers, bold, lists render live
Step 6: Content persists on every keystroke to IndexedDB
Step 7: Close tab and reopen — same file, same content, same cursor position
```

### Decision Points

| Decision            | Options                     | Info Needed                       | Cost of Wrong Choice    | Undo?                |
| ------------------- | --------------------------- | --------------------------------- | ----------------------- | -------------------- |
| Where to save files | Local / GitHub / Dropbox    | How each works, what's required   | Lost sync, data anxiety | Yes — switch anytime |
| Which repo/folder   | List of repos or path input | Ownership verification            | Wrong repo, wrong files | Yes — reconnect      |
| File name           | Text input                  | Existing file names (avoid dupes) | Confusion, overwrite    | Yes — rename         |
| Wikilink target     | Existing file or new        | File list with fuzzy search       | Broken link             | Yes — edit link text |

### Error Flows

**Offline → Sync attempt fails**

- Trigger: Cmd+S while offline, storage is remote
- Land on: "Unsynced (1)" indicator in title bar
- See: Subtle amber dot, "Changes saved locally. Will sync when connected."
- Recover: Wait for connectivity, engine auto-retries
- Steps to resume: 0 (automatic)

**Remote changed since last sync**

- Trigger: Sync engine detects divergent content
- Land on: Conflict modal
- See: Side-by-side local vs remote, three resolution options
- Recover: Pick "keep mine" / "keep theirs" / "merge"
- Steps to resume: 1 click

### Edge Cases

- **Empty state (first run):** Single empty file "Untitled.md", sidebar shows one entry. Clean, inviting — not a void.
- **Offline with local storage:** Full editor works, sidebar works, content persists. Sync queue grows silently.
- **Zero files:** "No files yet. Create one to start writing." with a prominent CTA.
- **Very long file:** CodeMirror virtualizes. No performance degradation.
- **Special characters in filenames:** Sanitized to markdown-safe. Warn on `/` (creates folder structure).

## Information Architecture

### IA Principles

1. **Flat over deep.** All files in one vault (or one folder path). No nested hierarchies beyond what the user explicitly creates with `/` in filenames.
2. **Object-oriented.** Everything is a file. Files are the only objects. No workspaces, no databases, no pages.
3. **Navigation matches mental model.** Users think "I want `ideas.md`" — not "I want to navigate to my workspace, then my notes folder, then ideas."

### Content Inventory

| Content Type    | Description                                   | Volume           | Priority | Relationships                          |
| --------------- | --------------------------------------------- | ---------------- | -------- | -------------------------------------- |
| File (.md)      | A markdown document with content and metadata | 0-1000+          | High     | Links to other files via [[wikilinks]] |
| Sync record     | Pending change waiting to sync                | 0-50 (transient) | Medium   | Belongs to a file, goes to a provider  |
| Provider config | Connection to GitHub, Dropbox, or local       | 0-3              | Medium   | One active at a time                   |
| Token           | Encrypted OAuth tokens                        | 0-3              | Low      | Belongs to a provider config           |

### Site Map

```
/
├── Editor (active file)          — The main writing surface
├── Sidebar (collapsible)         — File list, grouped by folder prefix
├── Command palette (Cmd+K)       — Search files, create, sync, commands
├── Title bar                     — Filename + sync status + mode toggles
└── Modals
    ├── Provider picker           — Choose where to save
    ├── Repo picker               — Select GitHub repo
    ├── Dropbox folder picker     — Select Dropbox path
    └── Conflict resolution       — Merge divergent versions

/landing
└── Marketing page                — What OpenNotes is, why use it
```

### Navigation Model

- **Primary:** Sidebar file list (left, collapsible). Shows all files, groups by `/` in path.
- **Secondary:** Title bar breadcrumb (top). Shows current file path, sync status, mode toggles.
- **Tertiary:** Command palette (Cmd+K). File search, create new, sync command, theme toggle.

### Labeling System

| Concept             | Label               | Rationale                                                                |
| ------------------- | ------------------- | ------------------------------------------------------------------------ |
| Collection of files | "Files"             | User vocabulary, not "Vault" (Obsidian's term) or "Workspace" (Notion's) |
| Create new file     | "+" icon button     | Universal, minimal. No text needed.                                      |
| Save to remote      | "Sync now"          | Active verb, clear result                                                |
| Delete file         | "Delete"            | Standard, no euphemism                                                   |
| Local storage       | "Just this browser" | Honest, clear about scope                                                |
| GitHub storage      | "GitHub"            | Brand name, recognizable                                                 |
| Dropbox storage     | "Dropbox"           | Brand name, recognizable                                                 |

### Search Strategy

- **Cmd+K command palette** searches file names (fuzzy match), not contents.
- **No full-text search in V1.** The use case is: "I know the file name, open it."
- **Wikilink autocomplete** is the inline search — type `[[` to search files by name for linking.

## Content Strategy

### Content Model

```
File:
  path:            string (e.g., "notes/ideas.md") — primary key
  content:         string (markdown) — the writing
  lastModified:    datetime — auto-updated on write
  synced:          boolean — local state matches remote
  syncPending:     boolean — queued for sync
```

### Content Hierarchy per Screen

**Editor screen:**
| Level 1 | Editor pane (the writing surface) |
| Level 2 | Title bar (filename + sync status) |
| Level 3 | Sidebar (file list) |
| Level 4 | Command palette overlay |

**Empty state (no files):**
| Level 1 | "Create your first file" with + button |
| Level 2 | "Your files live in your browser, GitHub, or Dropbox" |

### Microcopy Inventory

| Context                 | Copy                                    | Tone        |
| ----------------------- | --------------------------------------- | ----------- |
| New file button tooltip | "New file"                              | Brief       |
| Sync status: synced     | "Synced"                                | Calm        |
| Sync status: unsynced   | "{n} unsaved"                           | Informative |
| Sync status: syncing    | "Syncing…"                              | Reassuring  |
| Sync status: offline    | "Offline"                               | Factual     |
| Empty sidebar           | "No files yet"                          | Inviting    |
| Conflict modal title    | "Conflict: {filename}"                  | Direct      |
| Conflict: keep mine     | "Keep mine"                             | Clear       |
| Conflict: keep theirs   | "Keep theirs"                           | Clear       |
| Conflict: merge         | "Merge manually"                        | Clear       |
| Cmd+K placeholder       | "Search files…"                         | Brief       |
| Delete confirmation     | "Delete {filename}? This is permanent." | Serious     |

## Wireframes

### Screen Inventory

| Screen          | Flow             | Primary Action     | Info Displayed                 | Archetype      |
| --------------- | ---------------- | ------------------ | ------------------------------ | -------------- |
| Editor          | Writing          | Type markdown      | File content, rendered preview | Focused Writer |
| Sidebar         | Navigation       | Select file        | File list, sync status         | All            |
| Command palette | Search/Navigate  | Fuzzy search files | File list, commands            | All            |
| Provider picker | Connect storage  | Choose backend     | GitHub / Dropbox / Local       | Capture-Sync   |
| Repo picker     | GitHub setup     | Search/select repo | Repo list                      | Capture-Sync   |
| Conflict modal  | Resolve conflict | Choose version     | Local vs remote content        | All            |

### Layout Specification: Editor Screen

```
Screen:     Editor
Purpose:    Provide a distraction-free markdown writing surface with thin chrome
Layout:     3-column: Sidebar (240px, collapsible) | Editor (flex-1, centered content) | (none)
Hierarchy:  Content (center, primary) > Title bar (top, secondary) > Sidebar (left, tertiary)
Primary:    Writing in the CodeMirror editor
Secondary:  File switching, sync trigger, mode toggle
```

**Hierarchy Testing:**

- Squint test: Content area dominates (60%+ of viewport), sidebar recedes, title bar is a thin strip
- 5-second test: "This is a writing app. The text area is most important. I'd start typing."

### Responsive Behavior

| Breakpoint        | Sidebar                             | Editor                              |
| ----------------- | ----------------------------------- | ----------------------------------- |
| Desktop (1024+)   | Always visible, 240px               | Centered 720px max-width content    |
| Tablet (768-1023) | Collapsed by default, Sheet overlay | Full width                          |
| Mobile (<768)     | Sheet overlay only                  | Full width, mobile-friendly toolbar |

### State Variations: Editor Screen

| State                  | What shows                                                   |
| ---------------------- | ------------------------------------------------------------ |
| Default                | Editor with content, sidebar with files, title bar           |
| Empty (first run)      | Single empty file, editor shows blank canvas                 |
| Loading (file switch)  | Editor transitions to new content instantly (no spinner)     |
| Error (sync fail)      | Amber sync indicator, "1 unsaved" — non-blocking             |
| Maxed out (many files) | Sidebar scrolls, command palette for fast navigation         |
| Zen mode               | Sidebar hidden, title bar hidden, only the text area visible |

### Page Composition: Landing Page Narrative

**Hook (Act 1):** Large type: "Your notes. Your storage." — direct, confident. Below: one sentence explaining the product, one CTA. No hero gradient, no stock photo. Just conviction.

**Tension (Act 2):** "Every notes app wants your data. We don't." — diagram showing files living in GitHub/Dropbox/browser. Make the data flow visible.

**Turn (Act 3):** Product demo — an embedded, interactive editor showing markdown rendering live. Let visitors type. Let them feel how clean it is.

**Proof (Act 4):** Three storage backends, side by side. "Connect GitHub — one repo, free version history." "Connect Dropbox — same files, everywhere." "Or just this browser — no account needed."

**Climax (Act 5):** "Start writing." button. No signup. No email. Just the editor.

---

**Quality gates:**

- [x] Every JTBD has a mapped flow with error paths
- [x] Navigation depth does not exceed 3 levels
- [x] Every screen is wireframed with all states
- [x] Content hierarchy justified by scanning patterns
- [x] Responsive behavior at 3 breakpoints
- [x] Landing page has narrative arc with pacing variation
