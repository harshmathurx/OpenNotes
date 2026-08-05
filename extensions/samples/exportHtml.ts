/**
 * Sample extension: Export HTML.
 *
 * Converts the active note's markdown to a simple styled HTML document
 * (via the bundled `marked` package) and downloads it as a file using a
 * Blob. Fully local — no network, no server. Demonstrates: getActiveNote,
 * showToast, working entirely client-side.
 */

import { marked } from "marked"
import type { OpenNotesExtension } from "@/core/extensions/types"

function htmlDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
  body { max-width: 42rem; margin: 3rem auto; padding: 0 1rem;
         font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
         line-height: 1.6; color: #1a1a1a; }
  pre, code { font-family: ui-monospace, Menlo, monospace; }
  pre { background: #f4f4f4; padding: 0.75rem; border-radius: 6px; overflow-x: auto; }
  blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #555; }
</style>
</head>
<body>
${body}
</body>
</html>
`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export const exportHtmlExtension: OpenNotesExtension = {
  manifest: {
    id: "export-html",
    name: "Export HTML",
    version: "0.1.0",
    description: "Export the current note as a standalone HTML file.",
    author: "OpenNotes (built-in sample)",
  },

  activate(ctx) {
    ctx.registerCommand({
      id: "export-note-as-html",
      title: "Export note as HTML file",
      async run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast("No active note")
          return
        }

        const body = await marked.parse(note.content)
        const title = note.path.replace(/\.md$/i, "")
        const html = htmlDocument(title, body)

        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement("a")
        anchor.href = url
        anchor.download = `${title}.html`
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        URL.revokeObjectURL(url)

        api.showToast(`Exported ${title}.html`)
      },
    })
  },
}
