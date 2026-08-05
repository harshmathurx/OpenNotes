/**
 * Templates extension — pure engine.
 *
 * Everything here is framework-free and unit-testable:
 * - Variable substitution ({{title}}, {{date}}, {{date:FORMAT}}, {{time}},
 *   {{datetime}}, {{cursor}}) via {@link substitute}.
 * - Date formatting with native {@link Date} tokens — no dependencies.
 * - User-template CRUD persisted through the extension's namespaced
 *   `api.storage` under the "user-templates" key (JSON array).
 */

export const USER_TEMPLATES_STORAGE_KEY = "user-templates"

/** The minimal storage surface the engine needs (matches api.storage). */
export interface TemplateStorage {
  get(key: string): string | null
  set(key: string, value: string): void
}

/** A user-defined template persisted in extension storage. */
export interface UserTemplate {
  id: string
  name: string
  body: string
  /** ISO timestamp of creation. */
  createdAt: string
}

/** Inputs available to variable substitution at insert time. */
export interface TemplateContext {
  /** Note title — basename of the active note path without .md, or "Untitled". */
  title?: string
  /** The moment to render date/time tokens against. Defaults to now. */
  now?: Date
}

const MONTH_NAMES_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

const MONTH_NAMES_SHORT = MONTH_NAMES_LONG.map((m) => m.slice(0, 3))

const DAY_NAMES_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const DAY_NAMES_SHORT = DAY_NAMES_LONG.map((d) => d.slice(0, 3))

const pad2 = (n: number): string => String(n).padStart(2, "0")

/**
 * Format a Date using a small token set (subset of moment.js syntax):
 *   YYYY  4-digit year        2026
 *   YY    2-digit year        26
 *   MM    2-digit month       08
 *   MMM   short month name    Aug
 *   MMMM  long month name     August
 *   M     month number        8
 *   DD    2-digit day         05
 *   D     day number          5
 *   dddd  long weekday name   Wednesday
 *   ddd   short weekday name  Wed
 *   HH    2-digit 24h hour    09
 *   mm    2-digit minute      07
 *
 * Longest tokens are matched first so e.g. MMMM wins over MM.
 */
export function formatDate(date: Date, format: string): string {
  const tokens: Record<string, string> = {
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
    MMMM: MONTH_NAMES_LONG[date.getMonth()],
    MMM: MONTH_NAMES_SHORT[date.getMonth()],
    MM: pad2(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    DD: pad2(date.getDate()),
    D: String(date.getDate()),
    dddd: DAY_NAMES_LONG[date.getDay()],
    ddd: DAY_NAMES_SHORT[date.getDay()],
    HH: pad2(date.getHours()),
    mm: pad2(date.getMinutes()),
  }

  return format.replace(
    /YYYY|MMMM|MMM|YY|MM|M|DD|D|dddd|ddd|HH|mm/g,
    (token) => tokens[token] ?? token
  )
}

/** Default formats for the fixed (non-parameterized) tokens. */
const DATE_FORMAT = "YYYY-MM-DD"
const TIME_FORMAT = "HH:mm"
const DATETIME_FORMAT = "YYYY-MM-DD HH:mm"

/** Matches {{token}} or {{token:FORMAT}}. */
const TOKEN_PATTERN = /\{\{\s*([^{}:\s]+)\s*(?::([^{}]*))?\}\}/g

/**
 * Substitute template variables in `template` against `context`.
 *
 * Supported tokens:
 * - {{title}}          note title, or "Untitled"
 * - {{date}}           today as YYYY-MM-DD
 * - {{date:FORMAT}}    today rendered with {@link formatDate}
 * - {{time}}           now as HH:mm
 * - {{datetime}}       now as YYYY-MM-DD HH:mm
 * - {{cursor}}         caret marker — stripped (host positions the caret)
 *
 * Unknown tokens are left exactly as written. Pure: no I/O, no globals.
 */
export function substitute(
  template: string,
  context: TemplateContext = {}
): string {
  const now = context.now ?? new Date()
  const title = context.title ?? "Untitled"

  return template.replace(TOKEN_PATTERN, (raw, name: string, format?: string) => {
    switch (name) {
      case "title":
        return title
      case "date":
        return formatDate(now, format ?? DATE_FORMAT)
      case "time":
        return formatDate(now, format ?? TIME_FORMAT)
      case "datetime":
        return formatDate(now, format ?? DATETIME_FORMAT)
      case "cursor":
        return ""
      default:
        return raw
    }
  })
}

/** Derive a note title from a note path (basename without .md). */
export function titleFromPath(path: string | null | undefined): string {
  if (!path) return "Untitled"
  const basename = path.split("/").pop() ?? path
  const withoutExt = basename.replace(/\.md$/i, "")
  return withoutExt || "Untitled"
}

/** Build a substitution context from the active note path. */
export function contextForNote(
  path: string | null | undefined,
  now?: Date
): TemplateContext {
  return { title: titleFromPath(path), now }
}

/** Slugify a template name into a stable id fragment. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return slug || "template"
}

// ---------------------------------------------------------------------------
// User-template CRUD (persisted via namespaced api.storage)
// ---------------------------------------------------------------------------

/**
 * Read all user templates from storage.
 * Corrupt or malformed JSON degrades to an empty list — storage is
 * user-owned and best-effort, never a crash vector.
 */
export function listUserTemplates(storage: TemplateStorage): UserTemplate[] {
  const raw = storage.get(USER_TEMPLATES_STORAGE_KEY)
  if (!raw) return []

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (t): t is UserTemplate =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as UserTemplate).id === "string" &&
        typeof (t as UserTemplate).name === "string" &&
        typeof (t as UserTemplate).body === "string" &&
        typeof (t as UserTemplate).createdAt === "string"
    )
  } catch {
    return []
  }
}

function persist(storage: TemplateStorage, templates: UserTemplate[]): void {
  storage.set(USER_TEMPLATES_STORAGE_KEY, JSON.stringify(templates))
}

/**
 * Save (insert or replace-by-id) a user template.
 * When `input.id` is omitted, an id is minted as `user:<slug>-<timestamp>`.
 * Returns the stored template (with id + createdAt filled in).
 */
export function saveUserTemplate(
  storage: TemplateStorage,
  input: { id?: string; name: string; body: string },
  now: Date = new Date()
): UserTemplate {
  const templates = listUserTemplates(storage)
  const name = input.name.trim()
  const id = input.id ?? `user:${slugify(name)}-${now.getTime()}`

  const existing = templates.find((t) => t.id === id)
  const template: UserTemplate = {
    id,
    name,
    body: input.body,
    createdAt: existing?.createdAt ?? now.toISOString(),
  }

  persist(storage, [...templates.filter((t) => t.id !== id), template])
  return template
}

/**
 * Delete a user template by id. Returns true when something was removed.
 * Built-in templates are never in user storage, so this is user-only by
 * construction.
 */
export function deleteUserTemplate(
  storage: TemplateStorage,
  id: string
): boolean {
  const templates = listUserTemplates(storage)
  const next = templates.filter((t) => t.id !== id)
  if (next.length === templates.length) return false
  persist(storage, next)
  return true
}
