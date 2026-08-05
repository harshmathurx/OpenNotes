/**
 * Sample extension: Insert Boilerplate.
 *
 * Adds a slash-menu item (and a matching command) that inserts a
 * meeting-notes markdown template into the active note. Demonstrates:
 * slash items, insertIntoActiveNote, graceful no-active-note handling.
 */

import type { OpenNotesExtension } from "@/core/extensions/types"

const MEETING_TEMPLATE = `## Meeting notes

**Date:** 
**Attendees:** 

### Agenda
- 

### Discussion
- 

### Action items
- [ ] 
`

export const insertBoilerplateExtension: OpenNotesExtension = {
  manifest: {
    id: "insert-boilerplate",
    name: "Insert Boilerplate",
    version: "0.1.0",
    description: "Insert reusable markdown templates (meeting notes and more).",
    author: "OpenNotes (built-in sample)",
  },

  activate(ctx) {
    ctx.registerSlashItem({
      id: "meeting-notes-template",
      title: "Meeting notes template",
      description: "Agenda, discussion, and action items",
      insert() {
        return MEETING_TEMPLATE
      },
    })

    ctx.registerCommand({
      id: "insert-meeting-notes",
      title: "Insert meeting notes template",
      run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast("No active note")
          return
        }
        api.insertIntoActiveNote(MEETING_TEMPLATE)
        api.showToast("Inserted meeting notes template")
      },
    })
  },
}
