import { describe, expect, it } from "vitest"

import {
  buildLinkIndex,
  extractWikilinks,
  getBacklinks,
  getBrokenLinks,
  getOutgoingLinks,
  makeSnippet,
  noteDisplayName,
  type GraphNote,
} from "@/extensions/backlinks/linkGraph"

/**
 * Fixture vault: six notes, cross-linked, exercising alias links,
 * nested paths, .md / no-.md targets, case-insensitive basenames,
 * broken links, and a self-link.
 */
const vault: GraphNote[] = [
  {
    path: "Atlas.md",
    content: [
      "# Atlas",
      "The hub note. See [[Map Making]] and [[Legends|old legends]].",
      "Also links to [[Exploration/Routes]] and a missing [[Ghost Note]].",
    ].join("\n"),
  },
  {
    path: "Map Making.md",
    content: [
      "# Map Making",
      "Cartography depends on [[Atlas]] for orientation.",
      "Mentions [[Atlas]] twice — dedupe is expected.",
    ].join("\n"),
  },
  {
    path: "Legends.md",
    content: "# Legends\nOld tales. References [[atlas.md]] by lowercase name.",
  },
  {
    path: "Exploration/Routes.md",
    content:
      "# Routes\nNested note. Points back to [[Atlas]] and sideways to [[Map Making.md]].",
  },
  {
    path: "Orphan.md",
    content: "# Orphan\nNothing links here, and it links nowhere.",
  },
  {
    path: "Loop.md",
    content: "# Loop\nThis note links to [[Loop]] itself and to [[Atlas]].",
  },
]

describe("extractWikilinks", () => {
  it("parses plain targets", () => {
    expect(extractWikilinks("See [[Atlas]] for details.")).toEqual(["Atlas"])
  })

  it("parses alias form and returns the target, not the alias", () => {
    expect(extractWikilinks("See [[Legends|old legends]] now.")).toEqual([
      "Legends",
    ])
  })

  it("parses nested folder paths", () => {
    expect(extractWikilinks("Follow [[Exploration/Routes]] here.")).toEqual([
      "Exploration/Routes",
    ])
  })

  it("parses multiple links on one line, in order", () => {
    expect(extractWikilinks("[[A]] then [[B]] then [[C]]")).toEqual([
      "A",
      "B",
      "C",
    ])
  })

  it("dedupes repeated targets, keeping first-appearance order", () => {
    expect(extractWikilinks("[[A]] [[B]] [[A]] [[B]] [[C]]")).toEqual([
      "A",
      "B",
      "C",
    ])
  })

  it("treats 'Foo' and 'Foo.md' as the same target", () => {
    expect(extractWikilinks("[[Atlas]] and [[Atlas.md]]")).toEqual(["Atlas"])
  })

  it("trims whitespace inside brackets", () => {
    expect(extractWikilinks("[[  Atlas  ]]")).toEqual(["Atlas"])
  })

  it("ignores empty targets and alias-only text", () => {
    expect(extractWikilinks("[[]] [[|alias]] text")).toEqual([])
  })

  it("returns an empty array when there are no wikilinks", () => {
    expect(extractWikilinks("No links here, just [markdown](x).")).toEqual([])
  })
})

describe("buildLinkIndex", () => {
  it("maps every note to its resolved linked note paths", () => {
    const index = buildLinkIndex(vault)

    expect(index.get("Atlas.md")).toEqual(
      new Set(["Map Making.md", "Legends.md", "Exploration/Routes.md"])
    )
    expect(index.get("Orphan.md")).toEqual(new Set())
  })

  it("resolves targets with and without the .md extension", () => {
    const notes: GraphNote[] = [
      { path: "A.md", content: "Links to [[B]] and [[C.md]]." },
      { path: "B.md", content: "" },
      { path: "C.md", content: "" },
    ]
    const index = buildLinkIndex(notes)

    expect(index.get("A.md")).toEqual(new Set(["B.md", "C.md"]))
  })

  it("resolves basenames case-insensitively", () => {
    const index = buildLinkIndex(vault)
    // Legends.md links to [[atlas.md]] (lowercase) → resolves to Atlas.md.
    expect(index.get("Legends.md")).toEqual(new Set(["Atlas.md"]))
  })

  it("resolves nested paths case-insensitively", () => {
    const notes: GraphNote[] = [
      { path: "A.md", content: "[[exploration/routes]]" },
      { path: "Exploration/Routes.md", content: "" },
    ]
    const index = buildLinkIndex(notes)

    expect(index.get("A.md")).toEqual(new Set(["Exploration/Routes.md"]))
  })

  it("excludes unresolvable targets (broken links) from the index", () => {
    const index = buildLinkIndex(vault)
    // [[Ghost Note]] in Atlas.md resolves to nothing and must not appear.
    expect(index.get("Atlas.md")?.has("Ghost Note")).toBe(false)
    expect(index.get("Atlas.md")?.has("Ghost Note.md")).toBe(false)
  })

  it("keeps self-links as real edges", () => {
    const index = buildLinkIndex(vault)
    expect(index.get("Loop.md")).toEqual(new Set(["Loop.md", "Atlas.md"]))
  })
})

describe("getBacklinks", () => {
  it("returns notes linking to the target, sorted by path, with snippets", () => {
    const index = buildLinkIndex(vault)
    const backlinks = getBacklinks(index, "Atlas.md", vault)

    expect(backlinks.map((b) => b.fromPath)).toEqual([
      "Exploration/Routes.md",
      "Legends.md",
      "Loop.md",
      "Map Making.md",
    ])
    for (const bl of backlinks) {
      expect(bl.snippet.length).toBeGreaterThan(0)
    }
  })

  it("includes the wikilink text in the snippet", () => {
    const index = buildLinkIndex(vault)
    const backlinks = getBacklinks(index, "Atlas.md", vault)
    const fromMapMaking = backlinks.find((b) => b.fromPath === "Map Making.md")

    expect(fromMapMaking?.snippet).toContain("[[Atlas]]")
  })

  it("keeps snippets around 80 characters of context", () => {
    const long = `intro ${"padding ".repeat(20)}[[Target]] ${"padding ".repeat(20)}outro`
    const notes: GraphNote[] = [
      { path: "Source.md", content: long },
      { path: "Target.md", content: "" },
    ]
    const index = buildLinkIndex(notes)
    const [bl] = getBacklinks(index, "Target.md", notes)

    // ≤ 80 chars of body + two ellipsis markers.
    expect(bl.snippet.length).toBeLessThanOrEqual(84)
    expect(bl.snippet).toContain("[[Target]]")
    expect(bl.snippet.startsWith("…")).toBe(true)
    expect(bl.snippet.endsWith("…")).toBe(true)
  })

  it("does not list the note itself when it self-links", () => {
    const index = buildLinkIndex(vault)
    const backlinks = getBacklinks(index, "Loop.md", vault)

    expect(backlinks.map((b) => b.fromPath)).not.toContain("Loop.md")
  })

  it("returns an empty array for a note nobody links to", () => {
    const index = buildLinkIndex(vault)
    expect(getBacklinks(index, "Orphan.md", vault)).toEqual([])
  })

  it("returns an empty array for an unknown note path", () => {
    const index = buildLinkIndex(vault)
    expect(getBacklinks(index, "Does Not Exist.md", vault)).toEqual([])
  })
})

describe("makeSnippet", () => {
  it("collapses newlines so snippets render on one line", () => {
    const snippet = makeSnippet("line one\nline two [[Target]]\nline three")
    expect(snippet).not.toContain("\n")
    expect(snippet).toContain("[[Target]]")
  })

  it("returns an empty string when the note has no wikilink", () => {
    expect(makeSnippet("plain text")).toBe("")
  })
})

describe("getOutgoingLinks", () => {
  it("returns resolved paths the note links to, sorted", () => {
    const index = buildLinkIndex(vault)

    expect(getOutgoingLinks(index, "Atlas.md")).toEqual([
      "Exploration/Routes.md",
      "Legends.md",
      "Map Making.md",
    ])
  })

  it("returns an empty array for a note that links nowhere", () => {
    const index = buildLinkIndex(vault)
    expect(getOutgoingLinks(index, "Orphan.md")).toEqual([])
  })

  it("returns an empty array for an unknown note path", () => {
    const index = buildLinkIndex(vault)
    expect(getOutgoingLinks(index, "Does Not Exist.md")).toEqual([])
  })
})

describe("getBrokenLinks", () => {
  it("returns unresolved targets from the note", () => {
    expect(getBrokenLinks(vault, "Atlas.md")).toEqual(["Ghost Note"])
  })

  it("treats targets resolvable case-insensitively as not broken", () => {
    expect(getBrokenLinks(vault, "Legends.md")).toEqual([])
  })

  it("returns an empty array when the note has no broken links", () => {
    expect(getBrokenLinks(vault, "Map Making.md")).toEqual([])
  })

  it("returns an empty array for an unknown note path", () => {
    expect(getBrokenLinks(vault, "Does Not Exist.md")).toEqual([])
  })

  it("dedupes broken targets", () => {
    const notes: GraphNote[] = [
      { path: "A.md", content: "[[Missing]] and [[Missing]] again." },
    ]
    expect(getBrokenLinks(notes, "A.md")).toEqual(["Missing"])
  })
})

describe("noteDisplayName", () => {
  it("strips folders and the .md extension", () => {
    expect(noteDisplayName("Exploration/Routes.md")).toBe("Routes")
    expect(noteDisplayName("Atlas.md")).toBe("Atlas")
    expect(noteDisplayName("Atlas")).toBe("Atlas")
  })
})
