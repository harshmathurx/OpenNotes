/**
 * Backlinks — link graph model.
 *
 * Pure functions, no React. Extract [[wikilinks]] from note content,
 * build a note -> linked-notes index over a vault, and answer the three
 * questions the Backlinks panel asks: who links here, where does this
 * note link, and which links point at nothing yet.
 */

/** A note in the vault, as exposed by the extension API. */
export interface GraphNote {
  path: string
  content: string
}

/** A single inbound link: which note links here, plus context around the link. */
export interface Backlink {
  fromPath: string
  snippet: string
}

/**
 * A directed edge index: note path -> set of resolved note paths it links to.
 * Only existing notes appear as values; broken targets are excluded.
 */
export type LinkIndex = Map<string, Set<string>>

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

/** Strip a trailing ".md" (case-insensitive) from a path. */
function stripMdExtension(path: string): string {
  return path.replace(/\.md$/i, "")
}

/**
 * Normalize a raw wikilink target into a canonical lookup key:
 * trimmed, ".md" suffix removed, basename lower-cased (folder casing is
 * preserved since only the basename match is case-insensitive per spec,
 * but lower-casing the whole path keeps "Folder/Note" stable too).
 */
function normalizeTargetKey(target: string): string {
  return stripMdExtension(target.trim()).toLowerCase()
}

/** Canonical key for an actual note path (same normalization as targets). */
function normalizeNoteKey(path: string): string {
  return normalizeTargetKey(path)
}

/** Display name for a note path: basename without the .md extension. */
export function noteDisplayName(path: string): string {
  const base = path.split("/").pop() ?? path
  return stripMdExtension(base)
}

/**
 * Parse all [[wikilinks]] from note content.
 *
 * Supports [[target]] and [[target|alias]] forms and nested paths like
 * [[Folder/Note]]. Returns normalized target strings (trimmed, ".md"
 * stripped), de-duplicated, in first-appearance order.
 */
export function extractWikilinks(content: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const match of content.matchAll(WIKILINK_RE)) {
    const raw = match[1] ?? ""
    const target = raw.split("|")[0]?.trim() ?? ""
    if (!target) continue

    const normalized = stripMdExtension(target)
    const key = normalizeTargetKey(target)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
  }

  return out
}

/** First [[link]] occurrence in content, or null. Used for snippets. */
function findFirstWikilink(
  content: string
): { index: number; length: number } | null {
  // matchAll on a fresh regex instance to avoid lastIndex coupling.
  const match = /\[\[([^\]]+)\]\]/.exec(content)
  if (!match || match.index < 0) return null
  return { index: match.index, length: match[0].length }
}

/**
 * Extract context around the first [[link]] in the source note — the
 * raw slice is capped at 80 characters before whitespace cleanup, so
 * snippets stay short; ellipses mark truncation. Whitespace is
 * collapsed so the snippet reads cleanly on one line.
 */
export function makeSnippet(content: string): string {
  const link = findFirstWikilink(content)
  if (!link) return ""

  const rawBudget = 80
  const side = Math.max(0, Math.floor((rawBudget - link.length) / 2))
  const start = Math.max(0, link.index - side)
  const end = Math.min(content.length, start + rawBudget)
  const prefix = start > 0 ? "…" : ""
  const suffix = end < content.length ? "…" : ""
  const body = content.slice(start, end).replace(/\s+/g, " ").trim()

  return `${prefix}${body}${suffix}`
}

/**
 * Build the directed link index over the whole vault.
 *
 * Resolution rules for a wikilink target:
 * - Trim whitespace; drop any "|alias" part (handled in extractWikilinks).
 * - "Foo" and "Foo.md" refer to the same note.
 * - Matching is case-insensitive on the whole normalized path, so
 *   [[folder/note]], [[Folder/Note]] and [[Folder/Note.md]] all resolve.
 * - A target that matches no note path is a broken link and is omitted
 *   from the index (use getBrokenLinks to surface those).
 *
 * Self-links are kept — a note linking to itself is a real edge.
 */
export function buildLinkIndex(notes: GraphNote[]): LinkIndex {
  // Canonical key -> real note path (first path wins on collision).
  const noteByKey = new Map<string, string>()
  for (const note of notes) {
    const key = normalizeNoteKey(note.path)
    if (!noteByKey.has(key)) {
      noteByKey.set(key, note.path)
    }
  }

  const index: LinkIndex = new Map()
  for (const note of notes) {
    const targets = new Set<string>()
    for (const target of extractWikilinks(note.content)) {
      const resolved = noteByKey.get(normalizeTargetKey(target))
      if (resolved !== undefined) {
        targets.add(resolved)
      }
    }
    index.set(note.path, targets)
  }
  return index
}

/**
 * Notes that link TO `notePath`, each with a context snippet from the
 * source note. Results are sorted by source path for a stable UI order.
 */
export function getBacklinks(
  index: LinkIndex,
  notePath: string,
  notes: GraphNote[] = []
): Backlink[] {
  const contentByPath = new Map(notes.map((n) => [n.path, n.content]))
  const backlinks: Backlink[] = []

  for (const [fromPath, targets] of index) {
    if (fromPath === notePath) continue
    if (!targets.has(notePath)) continue
    backlinks.push({
      fromPath,
      snippet: makeSnippet(contentByPath.get(fromPath) ?? ""),
    })
  }

  backlinks.sort((a, b) => a.fromPath.localeCompare(b.fromPath))
  return backlinks
}

/** Resolved note paths that `notePath` links to, sorted for stable UI. */
export function getOutgoingLinks(index: LinkIndex, notePath: string): string[] {
  const targets = index.get(notePath)
  if (!targets) return []
  return [...targets].sort((a, b) => a.localeCompare(b))
}

/**
 * Wikilink targets in the note at `notePath` that do not resolve to any
 * existing note — the "create this note" candidates. Returned normalized
 * (trimmed, ".md" stripped), de-duplicated, in first-appearance order.
 */
export function getBrokenLinks(notes: GraphNote[], notePath: string): string[] {
  const note = notes.find((n) => n.path === notePath)
  if (!note) return []

  const noteKeys = new Set(notes.map((n) => normalizeNoteKey(n.path)))
  return extractWikilinks(note.content).filter(
    (target) => !noteKeys.has(normalizeTargetKey(target))
  )
}
