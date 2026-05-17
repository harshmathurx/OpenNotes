# 04-voice-and-tone.md — How the Product Speaks

## The Voice

OpenNotes speaks like a calm, confident writing companion. Not a cheerleader. Not a manual. A tool that respects your attention and knows when to stay quiet.

**Voice adjectives (constant):**

- **Quiet** — The interface doesn't shout. Labels are short. Errors are calm. Success doesn't celebrate. It just continues.
- **Direct** — No fluff. No "please" on buttons. No "oops!" on errors. Say what happened and what to do.
- **Confident** — The product knows what it is. No hedging. No "We recommend..." or "You might want to..." — just factual.
- **Clean** — Every word earns its place. If a sentence can be three words, it's three words. If a button can be one word, it's one word.

**Tense:** Present. **Person:** Second person where needed, first person never (the product doesn't have a "voice" — it's a tool). **Formality:** Casual-professional. Not stiff. Not slang.

## How We Sound

| Context               | Copy                                                             | Why it works                                               |
| --------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Button: new file      | "New file"                                                       | Two words. Active. Clear.                                  |
| Button: delete file   | "Delete"                                                         | One word. Serious. No euphemism.                           |
| Empty sidebar         | "No files yet"                                                   | Honest + inviting. Not a void.                             |
| Sync status: synced   | "Synced"                                                         | One word. Calm.                                            |
| Sync status: unsynced | "2 unsaved"                                                      | Two words. Quantity + status. Not alarming.                |
| Sync status: syncing  | "Syncing…"                                                       | Present tense. Implies progress.                           |
| Sync status: offline  | "Offline"                                                        | One word. Factual.                                         |
| Error: conflict       | "This file changed on both devices. Pick which version to keep." | Explains what happened. Gives clear action. Doesn't blame. |
| Wikilink (broken)     | Red underline. Tooltip: "File not found."                        | Visual signal + short explanation.                         |

## How We Never Sound

| ~~Bad~~                                                | ~~Why~~                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| ~~"Oops! Something went wrong."~~                      | Infantilizing. The product didn't trip. An error occurred.                                 |
| ~~"Your changes have been saved successfully!"~~       | "Saved" is enough. Exclamation points are for celebration, not routine.                    |
| ~~"We couldn't connect to your storage."~~             | The product doesn't have a "we." It's a tool. "Couldn't connect to GitHub."                |
| ~~"Please try again later."~~                          | "Please" on errors is performative politeness. "Try again" is enough.                      |
| ~~"Congratulations! You've created your first file."~~ | Creating a file is not an achievement. It's the first step of using the tool. No confetti. |
| ~~"Welcome to OpenNotes!"~~                            | The editor IS the welcome. No splash screen, no tour.                                      |

## Tone Shifts

| Context            | Tone               | Example                                                                             |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------- |
| Default / idle     | Quiet, calm        | (Nothing. No unnecessary text.)                                                     |
| Creation           | Brief confirmation | "File created"                                                                      |
| Success            | Silent             | (No toast for expected outcomes)                                                    |
| Minor error        | Direct, brief      | "File name can't be empty"                                                          |
| Major error        | Direct, helpful    | "Sync failed. Your changes are saved locally. Check your connection and try again." |
| Destructive action | Serious, clear     | "Delete 'notes.md'? This can't be undone."                                          |
| Loading            | Reassuring         | "Syncing…" (spinner + present participle)                                           |
| Empty state        | Inviting, helpful  | "No files yet. Create one to get started."                                          |
| Conflict           | Neutral, clear     | "This file changed on both devices."                                                |

## Error Message Framework

Every error follows: **What happened. Why. What to do.**

| Severity            | Pattern                    | Example                                              |
| ------------------- | -------------------------- | ---------------------------------------------------- |
| Inline (field)      | What's wrong → Fix         | "File name already exists"                           |
| Toast (action fail) | What failed → Next step    | "Couldn't save. Try again."                          |
| Modal (conflict)    | Context → Options → Action | "This file changed on both devices. Pick a version." |

Errors never:

- Blame the user ("You entered an invalid...")
- Use jargon ("ETag mismatch detected")
- Leave the user stranded (always provide a next step)

## Button Copy

| Instead of              | Use                                                   |
| ----------------------- | ----------------------------------------------------- |
| "Submit" / "OK"         | Specific verb: "Create", "Save", "Delete", "Sync now" |
| "Cancel"                | "Keep editing" or just the X icon                     |
| "Continue"              | Specific: "Connect GitHub", "Pick repo"               |
| "Yes / No" (in dialogs) | Specific: "Delete" / "Keep"                           |
| "Got it" / "Understood" | No button needed for info messages                    |

## Microcopy

| Element                           | Copy                |
| --------------------------------- | ------------------- |
| Title bar (no file open)          | "Untitled"          |
| Title bar (file open)             | `{filename}`        |
| Cmd+K placeholder                 | "Search files…"     |
| Cmd+K empty                       | "No files found"    |
| Slash menu input                  | "Type a command…"   |
| Wikilink autocomplete placeholder | "Link to file…"     |
| Provider picker: Local            | "Just this browser" |
| Provider picker: GitHub           | "GitHub"            |
| Provider picker: Dropbox          | "Dropbox"           |
| Repo picker title                 | "Pick a repository" |
| Repo picker search                | "Search repos…"     |
| Dropbox picker title              | "Dropbox folder"    |
| Dropbox picker default            | "/Apps/OpenNotes"   |

---

**Quality gates:**

- [x] 4 voice adjectives, each verifiable against real strings
- [x] Error messages follow what/why/next
- [x] Every tone context has a real example
- [x] Button copy uses specific verbs, not generic actions
- [x] No "please", no "oops", no exclamation points
