/**
 * Export panel — right-side docked panel for the Export extension.
 *
 * Two sections: "This note" (export the active note as Markdown or
 * styled HTML) and "All notes" (zip bundle or one combined HTML page),
 * plus a live note/word count. Actions delegate to the command runners
 * so panel and palette stay in lock-step.
 */

import { Download, FileArchive, FileCode, FileText } from "lucide-react"
import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { cn } from "@/lib/utils"
import { copy } from "./copy"
import { countWords } from "./exportEngine"
import { runExport } from "./index"

interface ExportPanelProps {
  api: OpenNotesExtensionAPI
}

function ExportActionButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
}: {
  icon: typeof FileText
  label: string
  hint: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border border-border/60 bg-background/60 px-3 py-2.5 text-left transition-colors",
        "hover:border-border hover:bg-accent/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-border/60 disabled:hover:bg-background/60"
      )}
    >
      <span className="flex size-8 flex-none items-center justify-center rounded-md border border-border/50 bg-muted/50 text-muted-foreground transition-colors group-hover:text-foreground">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-foreground">
          {label}
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {hint}
        </span>
      </span>
      <Download
        className="size-3.5 flex-none text-muted-foreground/60 transition-colors group-hover:text-foreground"
        aria-hidden="true"
      />
    </button>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        {description}
      </p>
    </div>
  )
}

export function ExportPanel({ api }: ExportPanelProps) {
  const notes = api.getNotes()
  const activeNote = api.getActiveNote()
  const wordCount = notes.reduce((sum, note) => sum + countWords(note.content), 0)

  const fire = (commandId: Parameters<typeof runExport>[0]) => {
    void runExport(commandId, api)
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-background p-4">
      {/* Workspace stats */}
      <div className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
        <p className="text-[11px] font-medium text-muted-foreground">
          {copy.panel.stats(notes.length, wordCount)}
        </p>
      </div>

      {/* This note */}
      <section className="space-y-2.5" aria-label={copy.panel.thisNoteHeading}>
        <SectionHeading
          title={copy.panel.thisNoteHeading}
          description={copy.panel.thisNoteDescription}
        />
        {activeNote ? (
          <div className="space-y-2">
            <ExportActionButton
              icon={FileText}
              label={copy.panel.markdownButton}
              hint={copy.panel.markdownHint}
              onClick={() => fire("note-md")}
            />
            <ExportActionButton
              icon={FileCode}
              label={copy.panel.htmlButton}
              hint={copy.panel.htmlHint}
              onClick={() => fire("note-html")}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-[11px] text-muted-foreground">
            {copy.panel.noActiveNote}
          </p>
        )}
      </section>

      <div className="border-t border-border/40" />

      {/* All notes */}
      <section className="space-y-2.5" aria-label={copy.panel.allNotesHeading}>
        <SectionHeading
          title={copy.panel.allNotesHeading}
          description={copy.panel.allNotesDescription}
        />
        {notes.length > 0 ? (
          <div className="space-y-2">
            <ExportActionButton
              icon={FileArchive}
              label={copy.panel.zipButton}
              hint={copy.panel.zipHint}
              onClick={() => fire("workspace-zip")}
            />
            <ExportActionButton
              icon={FileCode}
              label={copy.panel.combinedHtmlButton}
              hint={copy.panel.combinedHtmlHint}
              onClick={() => fire("workspace-html")}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 bg-muted/20 px-3 py-3 text-[11px] text-muted-foreground">
            {copy.panel.emptyWorkspace}
          </p>
        )}
      </section>
    </div>
  )
}
