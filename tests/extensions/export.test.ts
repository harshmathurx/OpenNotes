/**
 * Unit tests for the Export extension's pure engine builders.
 *
 * DOM download helpers (downloadBlob etc.) are intentionally not
 * covered here — they're thin browser glue exercised by the commands.
 */

import { describe, expect, it } from "vitest"
import {
  buildCombinedHtmlDocument,
  buildHtmlDocument,
  buildMarkdownManifest,
  buildNoteHtmlDocument,
  buildToc,
  buildTocHtml,
  countWords,
  escapeHtml,
  formatDateStamp,
  htmlFilename,
  markdownFilename,
  sanitizeArchivePath,
  slugify,
  zipFilename,
} from "@/extensions/export/exportEngine"

describe("slugify", () => {
  it("lowercases and replaces spaces with dashes", () => {
    expect(slugify("My Meeting Notes")).toBe("my-meeting-notes")
  })

  it("strips unsafe characters", () => {
    expect(slugify("Q&A: Roadmap (draft)!")).toBe("qa-roadmap-draft")
    expect(slugify("a/b\\c")).toBe("c")
    expect(slugify("Rock & Roll")).toBe("rock-roll")
  })

  it("strips the .md extension before slugging", () => {
    expect(slugify("Journal.md")).toBe("journal")
  })

  it("handles unicode: strips diacritics, falls back for non-latin", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme")
    expect(slugify("日本語のノート")).toBe("untitled")
  })

  it("collapses repeated dashes and trims edges", () => {
    expect(slugify("  --weird___name--  ")).toBe("weird-name")
  })

  it("never returns an empty string", () => {
    expect(slugify("")).toBe("untitled")
    expect(slugify("!!!")).toBe("untitled")
    expect(slugify("...")).toBe("untitled")
  })
})

describe("filenames", () => {
  it("builds markdown and html filenames from note names", () => {
    expect(markdownFilename("My Note.md")).toBe("my-note.md")
    expect(htmlFilename("My Note.md")).toBe("my-note.html")
    expect(markdownFilename("folder/Deep Note.md")).toBe("deep-note.md")
  })

  it("formats the date stamp as YYYYMMDD", () => {
    const date = new Date(2026, 0, 5) // Jan 5 2026 (local)
    expect(formatDateStamp(date)).toBe("20260105")
    const padded = new Date(2026, 10, 9) // Nov 9 2026
    expect(formatDateStamp(padded)).toBe("20261109")
  })

  it("names the zip bundle opennotes-export-YYYYMMDD.zip", () => {
    expect(zipFilename(new Date(2026, 7, 5))).toBe(
      "opennotes-export-20260805.zip"
    )
    expect(zipFilename(new Date(2026, 7, 5))).toMatch(
      /^opennotes-export-\d{8}\.zip$/
    )
  })
})

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;"
    )
  })
})

describe("buildHtmlDocument", () => {
  it("escapes a <script> injection in the title", () => {
    const html = buildHtmlDocument({
      title: `<script>alert("xss")</script>`,
      body: "<p>hi</p>",
    })
    expect(html).not.toContain("<script>alert")
    expect(html).toContain("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;")
  })

  it("sets <title> to the escaped title", () => {
    const html = buildHtmlDocument({ title: "My Note", body: "" })
    expect(html).toContain("<title>My Note</title>")
  })

  it("includes the body content", () => {
    const html = buildHtmlDocument({
      title: "t",
      body: "<p>some <strong>content</strong></p>",
    })
    expect(html).toContain("<p>some <strong>content</strong></p>")
  })

  it("is a standalone doc: inline style, no external deps, has footer", () => {
    const html = buildHtmlDocument({ title: "t", body: "<p>x</p>" })
    expect(html).toContain("<style>")
    expect(html).not.toContain("<link")
    expect(html).not.toContain(`src="http`)
    expect(html).toContain("Exported from OpenNotes")
    expect(html.startsWith("<!doctype html>")).toBe(true)
  })
})

describe("buildNoteHtmlDocument", () => {
  it("converts markdown to styled html with the note name as title", async () => {
    const html = await buildNoteHtmlDocument({
      path: "Ideas.md",
      content: "# Hello\n\nSome **bold** text.",
    })
    expect(html).toContain("<title>Ideas</title>")
    expect(html).toContain("<h1>Hello</h1>")
    expect(html).toContain("<strong>bold</strong>")
  })

  it("escapes a <script> in the note name (title)", async () => {
    const html = await buildNoteHtmlDocument({
      path: "notes/<script>alert(1)</script>.md",
      content: "safe",
    })
    // No executable markup survives into the document title —
    // tags are stripped from note names before interpolation.
    expect(html).not.toContain("<title><script>")
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).not.toContain("</script>")
    expect(html).toContain("<title>alert(1)</title>")
  })

  it("renders GFM task lists with checkboxes", async () => {
    const html = await buildNoteHtmlDocument({
      path: "Tasks.md",
      content: "- [ ] todo\n- [x] done",
    })
    expect(html).toContain('type="checkbox"')
    expect(html).toContain("checked")
  })

  it("renders fenced code blocks", async () => {
    const html = await buildNoteHtmlDocument({
      path: "Code.md",
      content: "```ts\nconst x = 1\n```",
    })
    expect(html).toContain("<pre>")
    expect(html).toContain("<code")
  })
})

describe("TOC generation", () => {
  const notes = [
    { path: "Daily Notes.md", content: "a" },
    { path: "projects/Roadmap.md", content: "b" },
    { path: "archive/roadmap.md", content: "c" }, // duplicate slug → suffixed
  ]

  it("builds slug ids and readable titles", () => {
    const toc = buildToc(notes)
    expect(toc).toEqual([
      { id: "daily-notes", title: "Daily Notes" },
      { id: "roadmap", title: "Roadmap" },
      { id: "roadmap-2", title: "roadmap" },
    ])
  })

  it("every TOC link resolves to a matching section id in the combined doc", async () => {
    const toc = buildToc(notes)
    const tocHtml = buildTocHtml(toc)
    const doc = await buildCombinedHtmlDocument(notes)

    for (const entry of toc) {
      // Link exists in TOC…
      expect(tocHtml).toContain(`href="#${entry.id}"`)
      // …and the anchor target exists exactly once in the document.
      expect(doc).toContain(`id="${entry.id}"`)
      const occurrences = doc.split(`id="${entry.id}"`).length - 1
      expect(occurrences).toBe(1)
    }
  })

  it("combined doc includes every note's content and a contents nav", async () => {
    const doc = await buildCombinedHtmlDocument(notes)
    expect(doc).toContain('class="export-toc"')
    expect(doc).toContain("<title>OpenNotes workspace</title>")
    expect(doc).toContain("<p>a</p>")
    expect(doc).toContain("<p>b</p>")
    expect(doc).toContain("<p>c</p>")
  })

  it("returns empty TOC html for an empty workspace", () => {
    expect(buildTocHtml([])).toBe("")
  })
})

describe("markdown manifest", () => {
  it("lists every note with a resolved relative link", () => {
    const date = new Date(2026, 7, 5)
    const manifest = buildMarkdownManifest(
      [
        { path: "Inbox.md", content: "one two" },
        { path: "projects/Roadmap.md", content: "three" },
      ],
      date
    )
    expect(manifest).toContain("# OpenNotes export")
    expect(manifest).toContain("2 notes")
    expect(manifest).toContain("- [Inbox](Inbox.md)")
    expect(manifest).toContain("- [Roadmap](projects/Roadmap.md)")
    expect(manifest).toContain(date.toISOString().slice(0, 10))
  })
})

describe("sanitizeArchivePath", () => {
  it("blocks traversal and normalizes separators", () => {
    expect(sanitizeArchivePath("../evil.md")).toBe("evil.md")
    expect(sanitizeArchivePath("a\\b\\c.md")).toBe("a/b/c.md")
    expect(sanitizeArchivePath("./x.md")).toBe("x.md")
  })

  it("ensures a .md extension", () => {
    expect(sanitizeArchivePath("note")).toBe("note.md")
    expect(sanitizeArchivePath("note.md")).toBe("note.md")
  })
})

describe("countWords", () => {
  it("counts words ignoring markdown punctuation", () => {
    expect(countWords("# Title\n\nhello **world**")).toBe(3)
    expect(countWords("one   two\nthree")).toBe(3)
    expect(countWords("")).toBe(0)
  })
})
