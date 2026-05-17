# 05-components.md — UI Elements, Domain Artifact, Empty States, Interactions

## Primary Domain Artifact: The Writing Surface

OpenNotes digitizes the notebook page. The domain artifact is not a "card" or a "ticket" — it's the page itself. Every element exists to frame and protect the writing surface.

```
[The Page]
domain object:    notebook page / clean sheet of paper
purpose:          provide an uninterrupted, beautiful writing surface
form signatures:
  - centered column (720px max) — like a printed page, the text has boundaries
  - generous margins (32px padding) — breathing room on all sides
  - rendered markdown — type plain text, see rich result (like a paper that reads your mind)
  - no visible toolbar — tools appear only when summoned (slash command, Cmd+K)
  - subtle paper-like line height (1.7) — generous spacing that makes text feel valuable
content zones:
  - title bar (top): filename, sync status, mode toggles
  - editor pane (center): the writing surface — CodeMirror 6
  - sidebar (left, collapsible): file navigation
materials:
  - background: pure white (oklch(1 0 0))
  - text: near-black (oklch(0.145 0 0))
  - accent: green (#16a34a) on interactive elements only
wear and life:
  - content grows over time — files accumulate, wikilinks form a web
  - sync status tells the story of the file's journey
  - version history (via GitHub) shows the evolution
states:
  - empty (new file): blinking cursor on line 1 — an invitation to write
  - active: content with rendered markdown
  - unsaved: subtle amber dot near filename
  - offline: CloudOff icon, changes queue locally
interaction:
  - every keystroke saves to IndexedDB (no save button)
  - Cmd+S flushes sync
  - slash (/) opens command menu for markdown actions
  - [[ opens wikilink autocomplete
responsive:
  - desktop: sidebar (240px) + centered editor (720px max) + white space
  - tablet: collapsible sidebar, full-width editor
  - mobile: Sheet overlay for file nav, full-width editor
accessibility:
  - CodeMirror is fully keyboard accessible
  - all icons have aria-labels
  - focus management on modals
  - ARIA live-region for sync status changes
```

## Component Catalog

### Button

```
purpose:      initiate actions
personality:  confident, clean, one-color
layout:       inline-flex, centered
sizing:       h-9 (36px), px-4 (16px horizontal padding)
typography:   14px / 500 / Geist
colors:
  default:    bg-primary (@green) text-primary-foreground (white)
  secondary:  bg-secondary (gray) text-secondary-foreground (dark)
  ghost:      transparent, hover: bg-accent (subtle gray)
  destructive: bg-destructive (red) text-white
states:       default, hover (darken 5%), active (darken 10%), disabled (opacity 0.5)
transitions:  150ms ease-out background-color
focus:        ring-2 ring-ring ring-offset-2
touch target: 44x44px minimum
```

### Sidebar

```
purpose:      navigate files, create new, see sync status
personality:  quiet, structured, out of the way
layout:       240px fixed, flex-col, overflow-hidden
  header:     "Files" label + "+" button
  body:       ScrollArea with file list
colors:       bg-white, 1px right border (border color)
file items:
  default:    text-sm text-foreground, py-1.5, px-2
  hover:      bg-accent (subtle gray)
  active:     bg-accent (slightly darker), font-medium
  icon:       FileText (14px, muted-foreground)
states:       expanded, collapsed (0 width, animated), empty ("No files yet")
```

### Title Bar

```
purpose:      show current file, sync status, mode controls
personality:  minimal, informative, top-edge
layout:       h-10 (40px), flex, items-center, justify-between, px-3
  left:       sidebar toggle icon | filename text
  right:      sync status indicator | zen mode toggle
colors:       bg-white, 1px bottom border
typography:   text-sm text-muted-foreground (filename)
states:       normal, zen-mode-hidden (slide up + fade out)
```

### Editor (CodeMirror 6)

```
purpose:      the heart of the product — writing
personality:  invisible, responsive, markdown-native
layout:       flex-1, overflow-auto, centered content (max-w-[720px], mx-auto, p-8)
typography (CodeMirror):
  default:    16px / 1.7 / Geist Mono
  headers:    rendered at appropriate sizes (28/22/18px), Geist (not mono)
  bold:       rendered bold
  italic:     rendered italic
  code:       Geist Mono, bg-muted, rounded
colors:
  text:       foreground
  headers:    foreground (bold), rendered not raw
  links:      primary (green)
  broken wikilink: destructive (red underline)
  cursor:     foreground
  selection:  bg-accent-foreground/10
extensions:
  - markdown (with live rendering)
  - wikilinks ([[ support, autocomplete, click-to-navigate)
  - slash menu (type / for command palette inside editor)
  - indentWithTab
  - Mod-s (Ctrl+S / Cmd+S) → flush sync
theme:
  '.cm-content': { padding: '32px', maxWidth: '720px', margin: '0 auto' }
  '.cm-line': { lineHeight: '1.7' }
  '.cm-gutters': { display: 'none' }  # No line numbers — writing tool, not IDE
states:       empty (cursor on line 1), content, loading (instant — no spinner), read-only
```

### Command Palette (Cmd+K)

```
purpose:      search files, run commands — keyboard-first navigation
personality:  fast, powerful, invisible until summoned
trigger:      Cmd+K / Ctrl+K
layout:       CommandDialog (centered modal overlay)
components:
  CommandInput: "Search files…" placeholder, auto-focus
  CommandList: groups
    - Files group: fuzzy-matched file names → open on Enter
    - Actions group: "New file", "Sync now", "Toggle theme"
behavior:
  - fuzzy search by file path
  - Enter → navigate to file / execute command
  - Escape → close
  - results update on every keystroke
colors:       bg-white, border, standard component tokens
states:       open (centered), closed (hidden), empty ("No files found")
```

### Sync Status Indicator

```
purpose:      show sync health at a glance
personality:  calm when fine, present when needed
layout:       inline-flex, items-center, gap-1
states:
  synced:     Cloud icon, green (primary), "Synced" micro label
  unsynced:   AlertCircle icon, amber, "{{n}} unsaved" micro label
  syncing:    Loader2 icon (animated spin), blue, "Syncing…" micro label
  offline:    CloudOff icon, muted-foreground, "Offline" micro label
  error:      AlertCircle icon, destructive, "Error" micro label
interaction:  click to flush sync
```

### Conflict Modal

```
purpose:      resolve version conflicts without data loss
personality:  clear, neutral, informative
layout:       DialogContent, max-w-3xl, max-h-[80vh]
components:
  header:     "Conflict: {{filename}}"
  tabs/pills: "Keep mine" | "Keep theirs" | "Merge manually"
  preview:    ScrollArea with monospaced content display
  footer:     "Cancel" | "Resolve" buttons
colors:       bg-white, border
behavior:
  - triggered by sync engine conflict detection
  - shows both versions side by side (or merged with conflict markers)
  - user picks resolution → content saved → sync flushed
  - never silently resolves — always requires user choice
```

### Provider Picker

```
purpose:      choose where files live
personality:  clear, informative, low-pressure
layout:       Dialog, three options in a vertical stack
options:
  - "Just this browser" — Local storage (IndexedDB). No account. No setup.
  - "GitHub" — Private repo. Free version history. Requires OAuth.
  - "Dropbox" — Syncs everywhere. Requires OAuth.
colors:       bg-white, each option has icon + title + description
behavior:
  - first run: shown automatically
  - can change anytime via settings
  - local is the default (works without choosing)
```

### Empty States

```
No files (sidebar):
  mood:    inviting
  copy:    "No files yet"
  action:  "Create one" button (primary)
  visual:  clean white space. Not an illustration. The page is the invitation.

New file (editor):
  mood:    anticipation
  copy:    (none — just a blinking cursor on line 1)
  action:  start typing
  visual:  the blank page IS the empty state. No placeholder text.

Search no results:
  mood:    neutral
  copy:    "No files found"
  action:  "Create {{query}}.md" suggestion
  visual:  simple text, no icon
```

### Loading States

```
File switching:  instant. Content appears immediately. No skeleton, no spinner.
Sync:            Loader2 animated icon (gentle spin). Low attention.
Page load:       The app IS the page. No loading screen. Content is local (IndexedDB).
```

## Micro-interactions

```
Primary action (button click):    150ms ease-out bg color shift
Modal open:                       200ms ease-out scale(0.95→1) + fade
Modal close:                      150ms ease-in scale(1→0.95) + fade
Sidebar collapse:                 200ms ease-out width transition
Zen mode toggle:                  300ms ease-out sidebar + title bar slide/fade
Sync indicator state change:      immediate color swap, icon swap
Wikilink hover:                   instant underline + cursor: pointer
```

### Signature Moment: Zen Mode Toggle

The ONE interaction where we invest disproportionately.

```
trigger:      click Maximize2 icon or press Cmd+Shift+Z
animation:    300ms spring animation
  sidebar:    slides left (translateX -240px), fades out
  title bar:  slides up (translateY -40px), fades out
  editor:     smoothly expands to full viewport width
  content:    remains centered, max-width increases from 720px to 840px
  cursor:     maintains position — zero disruption to writing
reduced:      instant toggle (no animation for prefers-reduced-motion)
```

## Scroll-Driven Interactions (Landing Page)

```
Scroll reveal:     sections fade up (opacity 0→1, translateY 20px→0) as they enter viewport
Trigger:           IntersectionObserver, threshold 0.15
Easing:            ease-out, 400ms
Performance:       CSS transforms and opacity only — 60fps guaranteed
```

---

**Quality gates:**

- [x] Primary domain artifact identified (The Writing Surface) with full spec
- [x] Every component has focus/keyboard behavior
- [x] Every component has reduced-motion fallback
- [x] Touch targets meet 44x44px minimum
- [x] Empty states have inviting copy, no sad-face icons
- [x] Signature moment identified (Zen mode)
- [x] No spinners for content loading — IndexedDB is instant
