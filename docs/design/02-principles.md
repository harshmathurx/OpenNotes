# 02-principles.md — The Decision Filter

## 1. The editor is the product

We invest in the writing experience above all else. Every feature competes for pixels against the text area. The text area always wins.

**Tradeoff:** Rich features lose to focused writing. A feature that adds UI chrome to the writing surface must prove its value is greater than the distraction it creates.

**Grounded in:** Primary archetype (The Focused Writer) — "I don't want to think about the editor."

## 2. Data belongs to the user, not to us

Files live in storage the user already controls. We never hold data on our servers. We never know what you wrote. We never see your files.

**Tradeoff:** No "sign in with OpenNotes." No managed cloud. No collaboration features (they require a server that holds your data). Ownership over convenience.

**Grounded in:** Research finding — "Ownership anxiety trumps latency anxiety." 6/8 interviewees.

## 3. Sync is invisible until it needs attention

Sync happens in the background. Cmd+S flushes immediately. Auto-sync on cadence. The sync indicator is calm (green dot) when synced, present (amber dot) when pending, and noticeable (amber badge) when at risk.

**Tradeoff:** We could show sync status more prominently (per-file badges, sync history). We choose calm. Sync is a background process, not a foreground concern.

**Grounded in:** Research insight — "Users only think about sync when it fails."

## 4. Markdown rendered live, syntax transparent

Type `# Header` and see it render as a header. Type `**bold**` and see bold. Never see raw markdown unless you want to. The rendered result is the default view.

**Tradeoff:** WYSIWYG editors show exactly what prints. Source-mode editors show exactly what's typed. We show rendered by default — markdown is the implementation detail, not the experience.

**Grounded in:** Research insight — "Markdown is a power user's comfort language, a regular user's blocker."

## 5. Files are flat by default, organized by name

No workspaces. No folders with drag-and-drop. Just files in a list. Grouping happens via `/` in filenames (e.g., `notes/ideas.md`). The interface treats them as paths but doesn't enforce a folder tree.

**Tradeoff:** Deep hierarchies help large collections. We choose simplicity. Cmd+K and wikilinks replace folder navigation.

**Grounded in:** IA principles — "Users think 'I want ideas.md' — not 'I want to navigate to my notes folder, then ideas.'"

## 6. Every keystroke is safe

Content saves to IndexedDB on every change. No "save" button needed (Cmd+S is for sync, not save). Close the tab, crash the browser, lose power — your words are there when you return.

**Tradeoff:** Aggressive auto-save means we can't have a "discard changes" flow. Every edit is committed. Undo is your discard.

**Grounded in:** The Focused Writer's core fear — losing work mid-flow.

## 7. Beautiful by subtraction, not addition

Polish means removing, not adding. Every element that can be hidden (sidebar in zen mode, title bar in full screen, toolbar entirely) is hidden by default or one click away.

**Tradeoff:** Discoverability loses to clarity. A hidden feature might be missed. A visible feature might distract.

**Grounded in:** 00-research.md — "The first 3 seconds determine the writing session."

## 8. Open by default, portable forever

Every file is a `.md` file. No proprietary format. No export step. Your files are already in your GitHub, your Dropbox, or your browser — exactly as `.md` files any editor can open.

**Tradeoff:** We can't add non-markdown features (tables with computed values, kanban boards, databases). Those lock you in. We'd rather you stay because you want to, not because you have to.

**Grounded in:** Data ownership principle — portable data is owned data.

---

| Principle                | One-liner                                              | Source                     |
| ------------------------ | ------------------------------------------------------ | -------------------------- |
| Editor is the product    | Text area always wins over chrome                      | Primary archetype          |
| Data belongs to user     | Files in user-controlled storage, never on our servers | 6/8 interviewees           |
| Invisible sync           | Green when fine, amber when pending, red when blocked  | Research insight           |
| Live markdown            | Rendered by default, syntax transparent                | Adoption barrier research  |
| Flat files               | No folders, / in filenames for grouping                | Mental model mapping       |
| Safe keystrokes          | Save to IndexedDB on every change                      | Core fear: data loss       |
| Beautiful by subtraction | Polish = removing elements                             | First impression research  |
| Open forever             | Every file is a plain .md                              | Data portability principle |

---

**Quality gates:**

- [x] 8 principles (7-10 range)
- [x] Each makes an explicit tradeoff
- [x] Each is testable against a real design decision
- [x] No contradictions between principles
- [x] Each traces to a research finding
