/**
 * Templates extension — labels and user-facing strings.
 * Centralized so the panel, commands, and toasts stay consistent.
 */

export const copy = {
  panel: {
    title: "Templates",
    builtinHeading: "Built-in",
    userHeading: "Yours",
    emptyUser: "No templates of your own yet. Open a note and save it as a template.",
    insert: "Insert",
    newNote: "New note",
    delete: "Delete",
    deleteConfirm: (name: string) => `Delete template "${name}"? This cannot be undone.`,
    insertIntoTitle: "Insert at cursor in the active note",
    newNoteTitle: "Create a new note from this template",
    deleteTitle: "Delete this template",
  },
  commands: {
    insertTitle: (name: string) => `Insert template: ${name}`,
    newNoteTitle: (name: string) => `New note: ${name}`,
    saveAsTitle: "Templates: Save active note as template",
    manageTitle: "Templates: Manage templates",
  },
  slash: {
    title: (name: string) => `${name} template`,
  },
  prompts: {
    saveAsName: "Name this template:",
  },
  toasts: {
    noActiveNote: "No active note",
    inserted: (name: string) => `Inserted "${name}" template`,
    noteCreated: (name: string) => `Created note from "${name}" template`,
    createUnsupported: "Creating notes isn't supported here",
    saved: (name: string) => `Saved template "${name}"`,
    saveEmptyName: "Template name can't be empty",
    deleted: (name: string) => `Deleted template "${name}"`,
    manage: "Open the Templates panel to manage templates",
    duplicate: (name: string) => `A template named "${name}" already exists — renamed`,
  },
} as const
