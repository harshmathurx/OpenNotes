/**
 * Export engine — pure, testable builders for the Export extension.
 *
 * Everything here is DOM-free except {@link downloadBlob}, which is a
 * thin side-effect wrapper kept separate so the builders can be unit
 * tested without a browser. Markdown → HTML conversion uses the bundled
 * `marked` package; the surrounding document, styles, filenames, zip
 * manifest, and TOC are all built here.
 */

import { marked } from "marked"
import { copy } from "./copy"

export interface ExportNote {
  path: string
  content: string
}

/* ------------------------------------------------------------------ */
/* Filenames                                                           */
/* ------------------------------------------------------------------ */

/**
 * Turn a note path or name into a safe filename slug: lowercase,
 * spaces → dashes, unsafe characters stripped, dots and path
 * separators removed. Always returns something non-empty.
 */
export function slugify(name: string): string {
  const base =
    (name
      .replace(/\.md$/i, "")
      .split(/[\\/]/)
      .pop() ?? "")
  const slug = base
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/['"&]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
  return slug || "untitled"
}

/** `My Note.md` → `my-note.md` */
export function markdownFilename(noteName: string): string {
  return `${slugify(noteName)}.md`
}

/** `My Note.md` → `my-note.html` */
export function htmlFilename(noteName: string): string {
  return `${slugify(noteName)}.html`
}

/** YYYYMMDD in local time — used in the zip bundle name. */
export function formatDateStamp(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}${month}${day}`
}

/** `opennotes-export-YYYYMMDD.zip` */
export function zipFilename(date: Date = new Date()): string {
  return `opennotes-export-${formatDateStamp(date)}.zip`
}

/* ------------------------------------------------------------------ */
/* HTML escaping                                                       */
/* ------------------------------------------------------------------ */

/** Escape text for safe interpolation into HTML text/attribute contexts. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/* ------------------------------------------------------------------ */
/* Standalone HTML document                                            */
/* ------------------------------------------------------------------ */

/**
 * Clean, neutral, light-reading theme. Fully inline — the exported file
 * has zero external dependencies and renders the same offline.
 */
const DOCUMENT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    max-width: 42rem;
    margin: 0 auto;
    padding: 3.5rem 1.5rem 4rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
      "Helvetica Neue", Arial, sans-serif;
    font-size: 1rem;
    line-height: 1.7;
    color: #1c1c1e;
    background: #fdfdfc;
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3, h4, h5, h6 {
    line-height: 1.25;
    font-weight: 650;
    color: #111113;
    margin: 2.25em 0 0.6em;
  }
  h1 { font-size: 1.9rem; letter-spacing: -0.02em; margin-top: 0; }
  h2 { font-size: 1.45rem; letter-spacing: -0.01em;
       padding-bottom: 0.3em; border-bottom: 1px solid #ececea; }
  h3 { font-size: 1.17rem; }
  h4 { font-size: 1rem; }
  p { margin: 1em 0; }
  a { color: #3b5bdb; text-decoration: none; border-bottom: 1px solid #c9d3f6; }
  a:hover { border-bottom-color: #3b5bdb; }
  ul, ol { padding-left: 1.5em; margin: 1em 0; }
  li { margin: 0.3em 0; }
  li > ul, li > ol { margin: 0.3em 0; }
  ul.task-list, li.task-list-item { list-style: none; }
  ul.task-list { padding-left: 0.25em; }
  li.task-list-item { display: flex; align-items: baseline; gap: 0.55em; }
  li.task-list-item input[type="checkbox"] {
    appearance: none;
    flex: none;
    width: 0.95em; height: 0.95em;
    border: 1.5px solid #b9b9b4;
    border-radius: 4px;
    margin: 0;
    transform: translateY(0.12em);
    background: #fff;
  }
  li.task-list-item input[type="checkbox"]:checked {
    background: #3b5bdb;
    border-color: #3b5bdb;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M2.5 6.2l2.3 2.3 4.7-5'/%3E%3C/svg%3E");
    background-size: 0.7em;
    background-position: center;
    background-repeat: no-repeat;
  }
  li.task-list-item input[type="checkbox"]:disabled { cursor: default; }
  code {
    font-family: ui-monospace, "SF Mono", SFMono-Regular, Menlo,
      Consolas, "Liberation Mono", monospace;
    font-size: 0.875em;
    background: #f2f2ef;
    border: 1px solid #e6e6e2;
    border-radius: 5px;
    padding: 0.12em 0.35em;
  }
  pre {
    background: #f6f6f3;
    border: 1px solid #e6e6e2;
    border-radius: 10px;
    padding: 0.9rem 1.1rem;
    overflow-x: auto;
    margin: 1.4em 0;
  }
  pre code { background: none; border: none; padding: 0; font-size: 0.85rem; }
  blockquote {
    margin: 1.4em 0;
    padding: 0.1em 0 0.1em 1.1em;
    border-left: 3px solid #d8d8d3;
    color: #55554f;
  }
  blockquote p { margin: 0.5em 0; }
  hr { border: none; border-top: 1px solid #e6e6e2; margin: 2.5em 0; }
  img { max-width: 100%; height: auto; border-radius: 8px; }
  table { border-collapse: collapse; width: 100%; margin: 1.4em 0; font-size: 0.95rem; }
  th, td { border: 1px solid #e0e0db; padding: 0.5em 0.8em; text-align: left; }
  th { background: #f6f6f3; font-weight: 600; }
  .export-note { margin-bottom: 4rem; }
  .export-note + .export-note { border-top: 1px solid #ececea; padding-top: 3rem; }
  .export-toc { background: #f6f6f3; border: 1px solid #e6e6e2;
    border-radius: 10px; padding: 1.25rem 1.5rem; margin: 0 0 3rem; }
  .export-toc h2 { font-size: 0.8rem; text-transform: uppercase;
    letter-spacing: 0.08em; color: #8a8a84; border: none; margin: 0 0 0.6em;
    padding: 0; }
  .export-toc ol { margin: 0; padding-left: 1.4em; }
  .export-toc li { margin: 0.35em 0; font-size: 0.95rem; }
  footer.export-footer {
    margin-top: 4rem;
    padding-top: 1.25rem;
    border-top: 1px solid #ececea;
    font-size: 0.8rem;
    color: #9c9c95;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
`.trim()

const FOOTER_HTML = `<footer class="export-footer"><span>${escapeHtml(
  copy.document.footer
)}</span></footer>`

export interface HtmlDocumentOptions {
  /** Document <title> and, for combined exports, the visible heading. */
  title: string
  /** Rendered HTML body content (already sanitized/converter output). */
  body: string
}

/**
 * Wrap rendered HTML in a complete, standalone, styled document.
 * The title is escaped; the body is trusted converter output.
 */
export function buildHtmlDocument({ title, body }: HtmlDocumentOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${DOCUMENT_CSS}
</style>
</head>
<body>
${body}
${FOOTER_HTML}
</body>
</html>
`
}

/**
 * Convert one note's markdown to a full standalone HTML document.
 * Configures marked to emit task-list checkboxes with stable classes.
 */
export async function buildNoteHtmlDocument(note: ExportNote): Promise<string> {
  const body = await markdownToHtml(note.content)
  return buildHtmlDocument({ title: noteTitle(note.path), body })
}

/* ------------------------------------------------------------------ */
/* Combined workspace HTML                                             */
/* ------------------------------------------------------------------ */

export interface TocEntry {
  /** Anchor id used on the note's <section>. */
  id: string
  /** Human-readable note title. */
  title: string
}

/**
 * Build the table-of-contents entries for a combined export. Anchor ids
 * are slugified note paths; duplicates get a numeric suffix so links
 * always resolve to exactly one section.
 */
export function buildToc(notes: ExportNote[]): TocEntry[] {
  const used = new Map<string, number>()
  return notes.map((note) => {
    const base = slugify(note.path)
    const seen = used.get(base) ?? 0
    used.set(base, seen + 1)
    return {
      id: seen === 0 ? base : `${base}-${seen + 1}`,
      title: noteTitle(note.path),
    }
  })
}

/** Render the TOC list HTML. Every entry links to `#${id}`. */
export function buildTocHtml(entries: TocEntry[]): string {
  if (entries.length === 0) return ""
  const items = entries
    .map(
      (entry) =>
        `<li><a href="#${escapeHtml(entry.id)}">${escapeHtml(entry.title)}</a></li>`
    )
    .join("\n")
  return `<nav class="export-toc" aria-label="${escapeHtml(copy.document.tocHeading)}">
<h2>${escapeHtml(copy.document.tocHeading)}</h2>
<ol>
${items}
</ol>
</nav>`
}

/**
 * Build one long standalone HTML document containing every note,
 * anchored sections, and a linked table of contents at the top.
 */
export async function buildCombinedHtmlDocument(
  notes: ExportNote[]
): Promise<string> {
  const toc = buildToc(notes)
  const sections: string[] = []
  for (let i = 0; i < notes.length; i++) {
    const body = await markdownToHtml(notes[i].content)
    sections.push(
      `<section class="export-note" id="${escapeHtml(toc[i].id)}">\n${body}\n</section>`
    )
  }
  const body = `${buildTocHtml(toc)}\n${sections.join("\n")}`
  return buildHtmlDocument({ title: copy.document.workspaceTitle, body })
}

/* ------------------------------------------------------------------ */
/* Markdown zip bundle (manifest)                                      */
/* ------------------------------------------------------------------ */

export interface ManifestEntry {
  /** Path inside the zip archive. */
  path: string
  /** Note title, for humans reading the manifest. */
  title: string
  words: number
}

/**
 * Build a manifest (as markdown) describing every note in the zip
 * bundle. Written to `manifest.md` at the archive root.
 */
export function buildMarkdownManifest(
  notes: ExportNote[],
  date: Date = new Date()
): string {
  const lines = [
    `# OpenNotes export`,
    ``,
    `Exported on ${date.toISOString().slice(0, 10)} — ${notes.length} ${
      notes.length === 1 ? "note" : "notes"
    }.`,
    ``,
    ...notes.map(
      (note) => `- [${noteTitle(note.path)}](${sanitizeArchivePath(note.path)})`
    ),
    ``,
  ]
  return lines.join("\n")
}

/** Count words in markdown, ignoring common punctuation tokens. */
export function countWords(markdown: string): number {
  return markdown
    .replace(/[#>*`_~\-[\]()!]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

/** Keep a note path safe inside a zip archive (no traversal). */
export function sanitizeArchivePath(path: string): string {
  const normalized = path.replaceAll("\\", "/")
  const safeParts = normalized
    .split("/")
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
  const joined = safeParts.join("/") || "Untitled.md"
  return joined.toLowerCase().endsWith(".md") ? joined : `${joined}.md`
}

/* ------------------------------------------------------------------ */
/* Download helper (side effects — not covered by unit tests)          */
/* ------------------------------------------------------------------ */

/**
 * Trigger a browser download for a Blob, then clean up the object URL.
 * Throws if the environment can't create URLs — callers should
 * try/catch and toast on failure.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.rel = "noopener"
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Build a Blob for a plain-text/markdown download. */
export function markdownBlob(content: string): Blob {
  return new Blob([content], { type: "text/markdown;charset=utf-8" })
}

/** Build a Blob for an HTML download. */
export function htmlBlob(documentHtml: string): Blob {
  return new Blob([documentHtml], { type: "text/html;charset=utf-8" })
}

/* ------------------------------------------------------------------ */
/* Internals                                                           */
/* ------------------------------------------------------------------ */

/** Human-readable title for a note path: basename without .md. */
export function noteTitle(path: string): string {
  // Strip markup BEFORE splitting on "/" — an injected tag can itself
  // contain a slash ("</script>") and corrupt the basename. Repeat the
  // tag pass so nested/adjacent tags can't leave partial tags behind,
  // then drop any residual angle brackets for defense in depth: the
  // title lands in <title>, TOC text, and link labels.
  let cleaned = path.replace(/\.md$/i, "")
  let previous = ""
  while (previous !== cleaned) {
    previous = cleaned
    cleaned = cleaned.replace(/<[^<>]*>/g, "")
  }
  const base = cleaned.split(/[\\/]/).pop() ?? cleaned
  const title = base.replace(/[<>]/g, "").trim()
  return title || copy.document.untitled
}

/** marked instance configured once for export rendering. */
async function markdownToHtml(markdown: string): Promise<string> {
  return marked.parse(markdown, {
    gfm: true,
    breaks: false,
    async: false,
  }) as string
}
