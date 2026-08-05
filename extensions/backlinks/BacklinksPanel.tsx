"use client"

/**
 * Backlinks — side panel component.
 *
 * Shows, for the active note: linked mentions (notes that link here,
 * with a context snippet), outgoing links (notes this note links to),
 * and broken links (targets that don't exist yet, with a create
 * affordance). Recomputes from the API on each render; the link index
 * is memoized on the notes array reference so re-renders stay cheap.
 */

import { useMemo } from "react"
import { ArrowLeft, ArrowUpRight, FileWarning, Link2 } from "lucide-react"

import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { cn } from "@/lib/utils"

import { copy } from "./copy"
import {
  buildLinkIndex,
  getBacklinks,
  getBrokenLinks,
  getOutgoingLinks,
  noteDisplayName,
  type Backlink,
} from "./linkGraph"

interface BacklinksPanelProps {
  api: OpenNotesExtensionAPI
}

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Link2
  label: string
  count: number
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-4 pb-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
        {count}
      </span>
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="px-3 pb-2 text-xs leading-relaxed text-muted-foreground/70">
      {message}
    </p>
  )
}

const rowClass =
  "group flex w-full flex-col gap-0.5 rounded-lg border border-transparent px-3 py-2 text-left transition-colors hover:border-border/60 hover:bg-accent/50"

function BacklinkRow({
  backlink,
  onOpen,
}: {
  backlink: Backlink
  onOpen: (path: string) => void
}) {
  return (
    <button
      type="button"
      className={rowClass}
      onClick={() => onOpen(backlink.fromPath)}
      title={backlink.fromPath}
    >
      <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span className="truncate">{noteDisplayName(backlink.fromPath)}</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
      {backlink.snippet && (
        <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {backlink.snippet}
        </span>
      )}
    </button>
  )
}

function OutgoingRow({
  path,
  onOpen,
}: {
  path: string
  onOpen: (path: string) => void
}) {
  return (
    <button
      type="button"
      className={cn(rowClass, "flex-row items-center justify-between gap-2")}
      onClick={() => onOpen(path)}
      title={path}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-foreground">
        <Link2 className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <span className="truncate">{noteDisplayName(path)}</span>
      </span>
      <ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/50 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

function BrokenRow({
  target,
  onCreate,
}: {
  target: string
  onCreate: (target: string) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        rowClass,
        "flex-row items-center justify-between gap-2",
        "border-dashed border-border/50 text-amber-600 dark:text-amber-500",
        "hover:border-amber-500/40 hover:bg-amber-500/5"
      )}
      onClick={() => onCreate(target)}
      title={`${copy.panel.brokenHint}: ${target}`}
    >
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        <FileWarning className="h-3 w-3 shrink-0 opacity-70" />
        <span className="truncate">{target}</span>
      </span>
      <span className="shrink-0 text-[10px] font-medium text-amber-600/70 dark:text-amber-500/70">
        {copy.panel.brokenHint}
      </span>
    </button>
  )
}

export function BacklinksPanel({ api }: BacklinksPanelProps) {
  const note = api.getActiveNote()
  const notes = api.getNotes()

  // Memoized on the notes array reference — rebuilt only when the host
  // hands us a new notes list, not on every render.
  const index = useMemo(() => buildLinkIndex(notes), [notes])

  const backlinks = useMemo(
    () => (note ? getBacklinks(index, note.path, notes) : []),
    [index, note, notes]
  )
  const outgoing = useMemo(
    () => (note ? getOutgoingLinks(index, note.path) : []),
    [index, note]
  )
  const broken = useMemo(
    () => (note ? getBrokenLinks(notes, note.path) : []),
    [notes, note]
  )

  const handleOpen = (path: string) => api.openNote(path)

  const handleCreate = (target: string) => {
    if (api.createNote) {
      void api
        .createNote(target)
        .then((path) => {
          if (path) {
            api.openNote(path)
            api.showToast(copy.commands.noteCreated(noteDisplayName(path)))
          }
        })
        .catch(() => api.showToast(copy.commands.createUnsupported))
    } else {
      api.showToast(copy.commands.createUnsupported)
    }
  }

  if (!note) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="border-b border-border/60 px-3 py-2.5">
          <h2 className="text-xs font-semibold text-foreground">
            {copy.panel.title}
          </h2>
        </div>
        <p className="px-3 py-4 text-xs text-muted-foreground">
          {copy.panel.emptyNote}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="border-b border-border/60 px-3 py-2.5">
        <h2 className="text-xs font-semibold text-foreground">
          {copy.panel.title}
        </h2>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {copy.panel.backlinkCount(backlinks.length)}
        </p>
      </div>

      <div className="flex flex-col gap-0.5 pb-4">
        <SectionHeader
          icon={ArrowLeft}
          label={copy.panel.sections.linkedMentions}
          count={backlinks.length}
        />
        {backlinks.length === 0 ? (
          <EmptyState message={copy.panel.empty.linkedMentions} />
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5">
            {backlinks.map((bl) => (
              <BacklinkRow key={bl.fromPath} backlink={bl} onOpen={handleOpen} />
            ))}
          </div>
        )}

        <SectionHeader
          icon={Link2}
          label={copy.panel.sections.outgoing}
          count={outgoing.length}
        />
        {outgoing.length === 0 ? (
          <EmptyState message={copy.panel.empty.outgoing} />
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5">
            {outgoing.map((path) => (
              <OutgoingRow key={path} path={path} onOpen={handleOpen} />
            ))}
          </div>
        )}

        <SectionHeader
          icon={FileWarning}
          label={copy.panel.sections.broken}
          count={broken.length}
        />
        {broken.length === 0 ? (
          <EmptyState message={copy.panel.empty.broken} />
        ) : (
          <div className="flex flex-col gap-0.5 px-1.5">
            {broken.map((target) => (
              <BrokenRow key={target} target={target} onCreate={handleCreate} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
