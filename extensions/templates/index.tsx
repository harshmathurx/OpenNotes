/**
 * Templates extension — rich note templates with variable substitution.
 *
 * Ships a curated set of built-in templates and supports user-defined
 * templates saved from any note (persisted in namespaced extension
 * storage via the engine's CRUD helpers).
 *
 * Surfaces:
 * - One slash item per built-in template (e.g. "Meeting notes template")
 *   whose insert() returns the substituted body.
 * - Commands per built-in template: "Insert template: X" and
 *   "New note: X". "New note: X" also works for user templates, reading
 *   them live from storage so newly saved templates work immediately.
 * - templates:save-as-template — save the active note as a user template.
 * - templates:manage — points to the Templates panel.
 * - A right-docked "Templates" panel listing built-in + user templates
 *   with Insert / New note / Delete (user only) actions.
 *
 * Registration strategy (documented trade-off): built-in templates are
 * registered statically. User templates surface in slash items after the
 * next app reload (slash items are collected once at activation), while
 * the panel and "New note: <built-in>"-style user flows read user
 * templates live from storage — so nothing is ever stale except the
 * slash-menu snapshot, which the panel covers.
 */

import { useCallback, useMemo, useState } from "react"
import { FilePlus2, LayoutTemplate, Plus, Trash2 } from "lucide-react"
import type {
  ExtensionCommand,
  ExtensionSlashItem,
  OpenNotesExtension,
  OpenNotesExtensionAPI,
} from "@/core/extensions/types"
import { BUILTIN_TEMPLATES, type BuiltinTemplate } from "./builtinTemplates"
import { copy } from "./copy"
import {
  contextForNote,
  deleteUserTemplate,
  listUserTemplates,
  saveUserTemplate,
  substitute,
  type UserTemplate,
} from "./engine"

// ---------------------------------------------------------------------------
// Shared actions
// ---------------------------------------------------------------------------

function insertTemplate(api: OpenNotesExtensionAPI, name: string, body: string) {
  const note = api.getActiveNote()
  if (!note) {
    api.showToast(copy.toasts.noActiveNote)
    return
  }
  api.insertIntoActiveNote(substitute(body, contextForNote(note.path)))
  api.showToast(copy.toasts.inserted(name))
}

async function newNoteFromTemplate(
  api: OpenNotesExtensionAPI,
  name: string,
  body: string
) {
  if (!api.createNote || !api.setActiveNoteContent) {
    api.showToast(copy.toasts.createUnsupported)
    return
  }
  const path = await api.createNote(name)
  if (!path) {
    api.showToast(copy.toasts.createUnsupported)
    return
  }
  api.setActiveNoteContent(substitute(body, contextForNote(path)))
  api.showToast(copy.toasts.noteCreated(name))
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

interface TemplateRowProps {
  name: string
  description?: string
  isUser: boolean
  onInsert: () => void
  onNewNote: () => void
  onDelete?: () => void
}

function TemplateRow({
  name,
  description,
  isUser,
  onInsert,
  onNewNote,
  onDelete,
}: TemplateRowProps) {
  return (
    <div className="group rounded-lg border border-border/60 bg-background p-2.5 text-xs transition-colors duration-200 hover:border-primary/40">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <LayoutTemplate className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">{name}</span>
          </div>
          {description && (
            <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {isUser && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title={copy.panel.deleteTitle}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-2 flex items-center gap-1.5 border-t border-border/20 pt-2">
        <button
          type="button"
          onClick={onInsert}
          title={copy.panel.insertIntoTitle}
          className="flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background/50 px-1.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="h-3 w-3" />
          {copy.panel.insert}
        </button>
        <button
          type="button"
          onClick={onNewNote}
          title={copy.panel.newNoteTitle}
          className="flex h-6 items-center gap-1 rounded-md border border-border/60 bg-background/50 px-1.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
        >
          <FilePlus2 className="h-3 w-3" />
          {copy.panel.newNote}
        </button>
      </div>
    </div>
  )
}

function TemplatesPanel({ api }: { api: OpenNotesExtensionAPI }) {
  // Storage is local and cheap to read; a version counter bumps whenever
  // the panel mutates storage so the list re-derives.
  const [version, setVersion] = useState(0)
  const userTemplates = useMemo(
    () => listUserTemplates(api.storage),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api.storage, version]
  )

  const handleDelete = useCallback(
    (template: UserTemplate) => {
      if (!window.confirm(copy.panel.deleteConfirm(template.name))) return
      if (deleteUserTemplate(api.storage, template.id)) {
        setVersion((v) => v + 1)
        api.showToast(copy.toasts.deleted(template.name))
      }
    },
    [api]
  )

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <section>
        <h3 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.panel.builtinHeading}
        </h3>
        <div className="space-y-2">
          {BUILTIN_TEMPLATES.map((t) => (
            <TemplateRow
              key={t.id}
              name={t.name}
              description={t.description}
              isUser={false}
              onInsert={() => insertTemplate(api, t.name, t.body)}
              onNewNote={() => void newNoteFromTemplate(api, t.name, t.body)}
            />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.panel.userHeading}
        </h3>
        {userTemplates.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-[11px] leading-snug text-muted-foreground">
            {copy.panel.emptyUser}
          </p>
        ) : (
          <div className="space-y-2">
            {userTemplates.map((t) => (
              <TemplateRow
                key={t.id}
                name={t.name}
                isUser
                onInsert={() => insertTemplate(api, t.name, t.body)}
                onNewNote={() => void newNoteFromTemplate(api, t.name, t.body)}
                onDelete={() => handleDelete(t)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const templatesExtension: OpenNotesExtension = {
  manifest: {
    id: "templates",
    name: "Templates",
    version: "0.1.0",
    description:
      "Insert rich note templates with date, time, and title variables.",
    author: "OpenNotes",
    defaultEnabled: true,
  },

  activate(ctx) {
    // --- Built-in templates: slash item + insert/new-note commands each.
    for (const template of BUILTIN_TEMPLATES) {
      registerTemplate(ctx, template)
    }

    // --- Save the active note as a user template.
    ctx.registerCommand({
      id: "save-as-template",
      title: copy.commands.saveAsTitle,
      run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast(copy.toasts.noActiveNote)
          return
        }

        const suggested = note.path.split("/").pop()?.replace(/\.md$/i, "") ?? ""
        const raw = window.prompt(copy.prompts.saveAsName, suggested)
        if (raw === null) return

        const name = raw.trim()
        if (!name) {
          api.showToast(copy.toasts.saveEmptyName)
          return
        }

        const clash = listUserTemplates(api.storage).some((t) => t.name === name)
        const finalName = clash ? `${name} (copy)` : name
        if (clash) api.showToast(copy.toasts.duplicate(name))

        saveUserTemplate(api.storage, { name: finalName, body: note.content })
        api.showToast(copy.toasts.saved(finalName))
      },
    })

    // --- Point users at the panel for management.
    ctx.registerCommand({
      id: "manage",
      title: copy.commands.manageTitle,
      run(api) {
        api.showToast(copy.toasts.manage)
      },
    })

    // --- Right-docked panel: browse/insert/manage all templates.
    ctx.registerPanel({
      id: "templates-panel",
      title: copy.panel.title,
      icon: "LayoutTemplate",
      side: "right",
      component: TemplatesPanel,
    })
  },
}

function registerTemplate(
  ctx: {
    registerCommand: (cmd: ExtensionCommand) => void
    registerSlashItem: (item: ExtensionSlashItem) => void
  },
  template: BuiltinTemplate
) {
  ctx.registerSlashItem({
    id: `builtin-${template.id}`,
    title: copy.slash.title(template.name),
    description: template.description,
    insert(api) {
      const note = api.getActiveNote()
      return substitute(template.body, contextForNote(note?.path))
    },
  })

  ctx.registerCommand({
    id: `insert-${template.id}`,
    title: copy.commands.insertTitle(template.name),
    run(api) {
      insertTemplate(api, template.name, template.body)
    },
  })

  ctx.registerCommand({
    id: `new-note-${template.id}`,
    title: copy.commands.newNoteTitle(template.name),
    async run(api) {
      await newNoteFromTemplate(api, template.name, template.body)
    },
  })
}
