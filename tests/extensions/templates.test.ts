import { describe, expect, it } from "vitest"
import {
  contextForNote,
  deleteUserTemplate,
  formatDate,
  listUserTemplates,
  saveUserTemplate,
  slugify,
  substitute,
  titleFromPath,
  USER_TEMPLATES_STORAGE_KEY,
  type TemplateStorage,
} from "@/extensions/templates/engine"
import { BUILTIN_TEMPLATES } from "@/extensions/templates/builtinTemplates"

// Fixed instant for deterministic date/time tests:
// Wednesday, August 5, 2026, 09:07 local time.
const NOW = new Date(2026, 7, 5, 9, 7, 0)

function makeStorage(initial: Record<string, string> = {}): TemplateStorage & {
  data: Record<string, string>
} {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    get: (key) => (key in data ? data[key] : null),
    set: (key, value) => {
      data[key] = value
    },
  }
}

describe("formatDate", () => {
  it("renders every supported token", () => {
    expect(formatDate(NOW, "YYYY")).toBe("2026")
    expect(formatDate(NOW, "YY")).toBe("26")
    expect(formatDate(NOW, "MM")).toBe("08")
    expect(formatDate(NOW, "MMM")).toBe("Aug")
    expect(formatDate(NOW, "MMMM")).toBe("August")
    expect(formatDate(NOW, "M")).toBe("8")
    expect(formatDate(NOW, "DD")).toBe("05")
    expect(formatDate(NOW, "D")).toBe("5")
    expect(formatDate(NOW, "ddd")).toBe("Wed")
    expect(formatDate(NOW, "dddd")).toBe("Wednesday")
    expect(formatDate(NOW, "HH")).toBe("09")
    expect(formatDate(NOW, "mm")).toBe("07")
  })

  it("prefers longer tokens over shorter ones", () => {
    expect(formatDate(NOW, "MMMM D, YYYY")).toBe("August 5, 2026")
    expect(formatDate(NOW, "dddd, MMMM D, YYYY")).toBe("Wednesday, August 5, 2026")
    expect(formatDate(NOW, "MMM D")).toBe("Aug 5")
  })

  it("leaves literal characters untouched", () => {
    expect(formatDate(NOW, "YYYY-MM-DD")).toBe("2026-08-05")
    expect(formatDate(NOW, "HH:mm")).toBe("09:07")
    expect(formatDate(NOW, "[on] D/M/YY")).toBe("[on] 5/8/26")
  })

  it("handles single-digit months and days", () => {
    const jan = new Date(2026, 0, 3, 15, 45)
    expect(formatDate(jan, "M/D/YYYY")).toBe("1/3/2026")
    expect(formatDate(jan, "MM/DD")).toBe("01/03")
    expect(formatDate(jan, "HH:mm")).toBe("15:45")
  })
})

describe("substitute", () => {
  it("replaces {{title}} with the provided title", () => {
    expect(substitute("# {{title}}", { title: "My Note", now: NOW })).toBe("# My Note")
  })

  it("falls back to Untitled when no title is given", () => {
    expect(substitute("{{title}}", { now: NOW })).toBe("Untitled")
    expect(substitute("{{title}}")).toBe("Untitled")
  })

  it("replaces {{date}} with YYYY-MM-DD", () => {
    expect(substitute("{{date}}", { now: NOW })).toBe("2026-08-05")
  })

  it("replaces {{date:FORMAT}} with the formatted date", () => {
    expect(substitute("{{date:dddd, MMMM D, YYYY}}", { now: NOW })).toBe(
      "Wednesday, August 5, 2026"
    )
    expect(substitute("{{date:MMM D, YY}}", { now: NOW })).toBe("Aug 5, 26")
  })

  it("replaces {{time}} with HH:mm", () => {
    expect(substitute("{{time}}", { now: NOW })).toBe("09:07")
  })

  it("replaces {{datetime}} with YYYY-MM-DD HH:mm", () => {
    expect(substitute("{{datetime}}", { now: NOW })).toBe("2026-08-05 09:07")
  })

  it("strips {{cursor}} markers", () => {
    expect(substitute("- {{cursor}}\n- next", { now: NOW })).toBe("- \n- next")
    expect(substitute("{{cursor}}{{cursor}}", { now: NOW })).toBe("")
  })

  it("leaves unknown tokens exactly as written", () => {
    expect(substitute("{{foo}} {{date2}} {{ titlex }}", { now: NOW })).toBe(
      "{{foo}} {{date2}} {{ titlex }}"
    )
  })

  it("replaces multiple different tokens in one body", () => {
    const body = "# {{title}}\n{{date}} {{time}}\n{{datetime}}\n{{cursor}}"
    expect(substitute(body, { title: "Sync", now: NOW })).toBe(
      "# Sync\n2026-08-05 09:07\n2026-08-05 09:07\n"
    )
  })

  it("is pure: same inputs give same outputs and context is not mutated", () => {
    const ctx = { title: "A", now: NOW }
    const body = "{{title}} {{date}}"
    const first = substitute(body, ctx)
    const second = substitute(body, ctx)
    expect(first).toBe(second)
    expect(ctx).toEqual({ title: "A", now: NOW })
  })
})

describe("titleFromPath / contextForNote", () => {
  it("derives a title from the basename without .md", () => {
    expect(titleFromPath("notes/ideas/My Note.md")).toBe("My Note")
    expect(titleFromPath("standalone.md")).toBe("standalone")
    expect(titleFromPath("no-extension")).toBe("no-extension")
  })

  it("falls back to Untitled for null, empty, or bare extension paths", () => {
    expect(titleFromPath(null)).toBe("Untitled")
    expect(titleFromPath(undefined)).toBe("Untitled")
    expect(titleFromPath("")).toBe("Untitled")
    expect(titleFromPath(".md")).toBe("Untitled")
  })

  it("builds a substitution context from a path", () => {
    expect(contextForNote("a/b/Trip.md", NOW)).toEqual({ title: "Trip", now: NOW })
    expect(contextForNote(null)).toEqual({ title: "Untitled", now: undefined })
  })
})

describe("slugify", () => {
  it("turns names into stable slugs", () => {
    expect(slugify("My Template!")).toBe("my-template")
    expect(slugify("  Standup — Daily  ")).toBe("standup-daily")
    expect(slugify("!!!")).toBe("template")
  })
})

describe("user-template CRUD", () => {
  it("starts empty when storage has nothing", () => {
    expect(listUserTemplates(makeStorage())).toEqual([])
  })

  it("saves and lists a template roundtrip", () => {
    const storage = makeStorage()
    const at = new Date(2026, 0, 1, 12, 0, 0)
    const saved = saveUserTemplate(storage, { name: "Standup", body: "# {{date}}" }, at)

    expect(saved.id).toBe(`user:standup-${at.getTime()}`)
    expect(saved.createdAt).toBe(at.toISOString())

    const listed = listUserTemplates(storage)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual(saved)

    // Raw storage holds the JSON array under the documented key.
    const raw = JSON.parse(storage.data[USER_TEMPLATES_STORAGE_KEY])
    expect(raw).toEqual([saved])
  })

  it("saves multiple templates and preserves order", () => {
    const storage = makeStorage()
    saveUserTemplate(storage, { name: "A", body: "a" })
    saveUserTemplate(storage, { name: "B", body: "b" })
    expect(listUserTemplates(storage).map((t) => t.name)).toEqual(["A", "B"])
  })

  it("replaces by id on re-save and keeps original createdAt", () => {
    const storage = makeStorage()
    const t0 = new Date(2026, 0, 1)
    const t1 = new Date(2026, 1, 1)
    const first = saveUserTemplate(storage, { name: "A", body: "v1" }, t0)
    const second = saveUserTemplate(
      storage,
      { id: first.id, name: "A2", body: "v2" },
      t1
    )

    const listed = listUserTemplates(storage)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toEqual({ ...second, createdAt: first.createdAt })
  })

  it("deletes by id and reports whether anything was removed", () => {
    const storage = makeStorage()
    const saved = saveUserTemplate(storage, { name: "A", body: "a" })

    expect(deleteUserTemplate(storage, saved.id)).toBe(true)
    expect(listUserTemplates(storage)).toEqual([])
    expect(deleteUserTemplate(storage, saved.id)).toBe(false)
  })

  it("degrades to empty list on corrupt storage", () => {
    expect(listUserTemplates(makeStorage({ [USER_TEMPLATES_STORAGE_KEY]: "{nope" }))).toEqual([])
    expect(
      listUserTemplates(makeStorage({ [USER_TEMPLATES_STORAGE_KEY]: JSON.stringify({ a: 1 }) }))
    ).toEqual([])
    expect(
      listUserTemplates(
        makeStorage({
          [USER_TEMPLATES_STORAGE_KEY]: JSON.stringify([
            { id: "ok", name: "Ok", body: "b", createdAt: "x" },
            { id: 123, name: "bad" },
            null,
          ]),
        })
      )
    ).toEqual([{ id: "ok", name: "Ok", body: "b", createdAt: "x" }])
  })

  it("trims template names on save", () => {
    const storage = makeStorage()
    const saved = saveUserTemplate(storage, { name: "  Padded  ", body: "b" })
    expect(saved.name).toBe("Padded")
  })
})

describe("built-in template registry", () => {
  it("ships the promised set of templates", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual([
      "meeting-notes",
      "daily-journal",
      "weekly-review",
      "project-brief",
      "reading-notes",
      "decision-log",
      "brainstorm",
      "book-summary",
    ])
  })

  it("has unique ids", () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("every template has a name, description, and non-empty body", () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.name.trim().length).toBeGreaterThan(0)
      expect(t.description.trim().length).toBeGreaterThan(0)
      expect(t.body.trim().length).toBeGreaterThan(0)
    }
  })

  it("bodies only use supported tokens", () => {
    const supported = new Set(["title", "date", "time", "datetime", "cursor"])
    for (const t of BUILTIN_TEMPLATES) {
      const tokens = [...t.body.matchAll(/\{\{\s*([^{}:\s]+)/g)].map((m) => m[1])
      for (const token of tokens) {
        expect(supported.has(token), `${t.id} uses unsupported token {{${token}}}`).toBe(true)
      }
    }
  })

  it("bodies render without leftover known tokens after substitution", () => {
    for (const t of BUILTIN_TEMPLATES) {
      const rendered = substitute(t.body, { title: "Test", now: NOW })
      expect(rendered).not.toMatch(/\{\{(title|date|time|datetime|cursor)[^}]*\}\}/)
    }
  })
})
