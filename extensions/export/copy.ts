/**
 * Export extension — user-facing strings.
 *
 * Centralized so the panel, commands, and toasts stay consistent and
 * the extension is easy to localize later.
 */

export const copy = {
  panel: {
    title: "Export",
    thisNoteHeading: "This note",
    allNotesHeading: "All notes",
    thisNoteDescription: "Download the note you're currently editing.",
    allNotesDescription: "Bundle the whole workspace into one file.",
    markdownButton: "Markdown",
    markdownHint: "Raw .md, exactly as written",
    htmlButton: "HTML",
    htmlHint: "Styled, standalone .html page",
    zipButton: "Zip bundle",
    zipHint: "Every note as .md plus a manifest",
    combinedHtmlButton: "Combined HTML",
    combinedHtmlHint: "One page, all notes, with a contents list",
    noActiveNote: "Open a note to export it.",
    emptyWorkspace: "Nothing to export yet.",
    stats: (notes: number, words: number) =>
      `${notes} ${notes === 1 ? "note" : "notes"} · ${words.toLocaleString("en-US")} ${words === 1 ? "word" : "words"}`,
  },

  toast: {
    noActiveNote: "No active note",
    nothingToExport: "Nothing to export",
    exported: (filename: string) => `Exported ${filename}`,
    failed: "Export failed — please try again",
  },

  document: {
    footer: "Exported from OpenNotes",
    tocHeading: "Contents",
    untitled: "Untitled",
    workspaceTitle: "OpenNotes workspace",
  },
} as const
