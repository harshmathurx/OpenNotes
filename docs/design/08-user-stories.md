# User Stories & Journey Map

## Primary Archetype: The Focused Writer

> "I don't want to think about the editor. I want to think about what I'm writing."

---

## User Stories

### US-1: First Visit — Immediate Writing

**As a** first-time visitor  
**I want to** start writing within 3 seconds of opening the app  
**So that** I can capture my thoughts before they disappear

**Acceptance Criteria:**

- [ ] App loads in < 2 seconds on 3G
- [ ] No signup, no onboarding tour, no "welcome" modal
- [ ] Single click (or Cmd+N) creates a new file
- [ ] Cursor is active immediately after file creation
- [ ] First keystroke saves to local storage instantly

**Journey:**

```
1. Land on opennotes.app → see empty canvas
2. Press Cmd+N (or click "Create first file")
3. File "Untitled.md" appears, cursor blinks in editor
4. Start typing immediately
5. Every keystroke saves silently
```

---

### US-2: Daily Writing Session

**As a** returning user  
**I want to** continue my last note instantly  
**So that** I maintain my writing flow

**Acceptance Criteria:**

- [ ] Last active file opens automatically
- [ ] Cursor position is restored (V2)
- [ ] Content is exactly as I left it
- [ ] No "loading" state visible

**Journey:**

```
1. Open app from pinned tab
2. See last file with cursor at end
3. Continue typing seamlessly
4. Cmd+S to trigger sync (if connected)
```

---

### US-3: Switching Between Notes

**As a** knowledge gardener  
**I want to** quickly switch between notes  
**So that** I can reference and connect ideas

**Acceptance Criteria:**

- [ ] Sidebar shows all files, active file highlighted
- [ ] Click file in sidebar → instant switch (< 100ms)
- [ ] Cmd+K opens command palette with fuzzy search
- [ ] Search by filename, Enter to open
- [ ] Each file has independent content (no cross-contamination)

**Journey:**

```
1. Writing in "ideas.md"
2. Remember a related note → Cmd+K
3. Type "meet" → "meetings.md" appears
4. Press Enter → switch to meetings.md
5. Read reference, Cmd+K, type "idea", Enter → back to ideas.md
```

---

### US-4: Markdown Without Memorizing Syntax

**As a** non-technical writer  
**I want to** format text without knowing markdown  
**So that** I can focus on content, not syntax

**Acceptance Criteria:**

- [ ] Type `/` at start of line → slash menu appears
- [ ] Menu shows: Heading 1/2/3, Bullet, Numbered, Quote, Code
- [ ] Select option → markdown syntax inserted
- [ ] Headers render big, bold renders bold, lists have bullets
- [ ] Markdown syntax is subtle (light gray) when visible

**Journey:**

```
1. Type "My Thoughts" on first line
2. Press Home, type "/" → slash menu appears
3. Select "Heading 1" → "# " inserted before text
4. Text instantly renders as large heading
5. Press Enter, type "- Main idea" → renders as bullet
```

---

### US-5: Linking Notes Together

**As a** knowledge gardener  
**I want to** link between my notes  
**So that** my notes form a web of connected ideas

**Acceptance Criteria:**

- [ ] Type `[[` → autocomplete shows existing files
- [ ] Select file → wikilink inserted: `[[filename]]`
- [ ] Wikilink renders as green underlined text
- [ ] Click wikilink → navigate to that file
- [ ] Create new file from wikilink if it doesn't exist

**Journey:**

```
1. Writing in "design-systems.md"
2. Type "See also [[col" → autocomplete shows "colors.md"
3. Select "colors.md" → `[[colors.md]]` inserted
4. Link renders green, clickable
5. Click link → navigates to colors.md
```

---

### US-6: Zen Mode — Zero Distraction

**As a** deep thinker  
**I want to** hide all chrome and just write  
**So that** I can enter flow state

**Acceptance Criteria:**

- [ ] Cmd+Shift+Z toggles zen mode
- [ ] Sidebar hides, title bar hides, all chrome disappears
- [ ] Editor expands to full viewport
- [ ] Hover at top shows "Exit zen mode" button
- [ ] Escape key exits zen mode
- [ ] Content remains centered, comfortable line length

**Journey:**

```
1. Writing in editor, sidebar and title bar visible
2. Press Cmd+Shift+Z → chrome fades out over 300ms
3. Only the text remains, centered, calm
4. Write for 45 minutes uninterrupted
5. Press Escape → chrome fades back in
```

---

### US-7: Sync to My Storage

**As a** data-conscious user  
**I want to** save my files to GitHub or Dropbox  
**So that** my notes are backed up and accessible everywhere

**Acceptance Criteria:**

- [ ] One-click connect to GitHub (OAuth) or Dropbox
- [ ] Files sync as plain .md files in my repo/folder
- [ ] Sync happens in background, no interruption
- [ ] "Synced" indicator in title bar (green dot)
- [ ] Cmd+S forces immediate sync
- [ ] Offline changes queue, sync when reconnected

**Journey:**

```
1. Click "Synced" indicator → provider picker opens
2. Select "GitHub" → OAuth flow opens
3. Authorize → pick repo "my-notes"
4. Indicator changes to "Syncing..." then "Synced"
5. Close laptop, write on plane (offline)
6. Reconnect → changes auto-sync
```

---

### US-8: Resolving Conflicts

**As a** multi-device user  
**I want to** resolve version conflicts without losing work  
**So that** I trust my data is safe

**Acceptance Criteria:**

- [ ] Conflict detected → modal appears
- [ ] Show both versions side by side
- [ ] Three options: "Keep mine", "Keep theirs", "Merge"
- [ ] Manual merge shows conflict markers
- [ ] Resolution saves and syncs immediately

**Journey:**

```
1. Edit "todo.md" on laptop
2. Edit same file on phone while laptop offline
3. Laptop comes online → sync detects conflict
4. Modal shows: local version vs remote version
5. Choose "Keep mine" → local version saved, syncs
```

---

### US-9: Rename and Organize

**As an** organized thinker  
**I want to** rename files inline  
**So that** my notes stay organized without friction

**Acceptance Criteria:**

- [ ] Click filename in title bar → inline edit mode
- [ ] Type new name, press Enter → file renamed
- [ ] Sidebar updates instantly
- [ ] Wikilinks to old name break (show red underline)
- [ ] Broken wikilinks can be clicked to fix

**Journey:**

```
1. Title bar shows "random-thoughts.md"
2. Click title → input appears, text selected
3. Type "design-principles.md", press Enter
4. File renamed everywhere
5. [[random-thoughts.md]] in other files turns red
6. Click broken link → option to update or create new file
```

---

### US-10: Delete with Confidence

**As a** note-taker  
**I want to** delete files with a single action  
**So that** I can clean up without ceremony

**Acceptance Criteria:**

- [ ] Hover file in sidebar → trash icon appears
- [ ] Click trash → file deleted immediately
- [ ] No confirmation modal (undo is the safety net)
- [ ] Deleted file removed from sidebar instantly
- [ ] Editor switches to next file (or empty state if last)

**Journey:**

```
1. Sidebar shows 5 files
2. Hover "draft-ideas.md" → trash icon appears
3. Click trash → file disappears, sidebar updates
4. Editor switches to next file automatically
```

---

## Keyboard Shortcut Map

| Shortcut           | Action                       | Context |
| ------------------ | ---------------------------- | ------- |
| `Cmd+N` / `Ctrl+N` | Create new file              | Global  |
| `Cmd+K` / `Ctrl+K` | Open command palette         | Global  |
| `Cmd+S` / `Ctrl+S` | Flush sync                   | Global  |
| `Cmd+Shift+Z`      | Toggle zen mode              | Global  |
| `Escape`           | Close modal/palette/exit zen | Global  |
| `/` at line start  | Open slash menu              | Editor  |
| `[[`               | Start wikilink               | Editor  |
| `Cmd+B` / `Ctrl+B` | Bold selection               | Editor  |
| `Cmd+I` / `Ctrl+I` | Italic selection             | Editor  |

---

## Error States

| State                     | What User Sees                     | Recovery                  |
| ------------------------- | ---------------------------------- | ------------------------- |
| Offline + unsaved changes | Amber dot, "{n} unsaved"           | Auto-retry when online    |
| Sync conflict             | Modal with both versions           | Pick resolution           |
| Broken wikilink           | Red underline, tooltip "Not found" | Click to create or fix    |
| Empty editor (new file)   | Blinking cursor on line 1          | Start typing              |
| No files (first run)      | Empty state with CTA               | Click "Create first file" |

---

## Quality Gates for Daily Use

- [ ] Create file → type → switch file → content preserved (no cross-contamination)
- [ ] Zen mode enter/exit is instant and reversible
- [ ] Cmd+K finds any file in < 3 keystrokes
- [ ] Markdown syntax is subtle or invisible
- [ ] Dark mode is comfortable for 2+ hour sessions
- [ ] Sync indicator is accurate (green = safe, amber = pending)
- [ ] File rename updates everything instantly
- [ ] Deleted file is gone, no ghost entries
