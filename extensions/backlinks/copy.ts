/**
 * Backlinks — user-facing strings.
 * Kept in one place so the panel and commands stay copy-consistent.
 */

export const copy = {
  panel: {
    title: "Backlinks",
    emptyNote: "Open a note to see its links.",
    sections: {
      linkedMentions: "Linked mentions",
      outgoing: "Outgoing links",
      broken: "Broken links",
    },
    empty: {
      linkedMentions: "No notes link here yet.",
      outgoing: "This note doesn't link anywhere yet.",
      broken: "No broken links.",
    },
    brokenHint: "Create this note",
    backlinkCount: (n: number) => (n === 1 ? "1 note links here" : `${n} notes link here`),
  },
  commands: {
    toggleTitle: "Toggle backlinks panel",
    copyTitle: "Copy backlinks as markdown list",
    toggleToast: "Open the Backlinks panel from the panel switcher",
    noActiveNote: "No active note",
    copied: (n: number) => `Copied ${n} backlink${n === 1 ? "" : "s"}`,
    copyFailed: "Couldn't copy to clipboard",
    nothingToCopy: "No backlinks to copy",
    noteCreated: (name: string) => `Created ${name}`,
    createUnsupported: "Creating notes isn't supported here",
  },
} as const
