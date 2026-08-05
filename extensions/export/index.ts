/**
 * Export extension.
 *
 * Exports the current note or the whole workspace to clean Markdown,
 * styled standalone HTML, or a .zip bundle. Registers four commands
 * (palette) and one right-side panel; all heavy lifting lives in the
 * pure `exportEngine` module and the battle-tested zip builder in
 * `core/export/zip.ts`.
 */

import type {
  OpenNotesExtension,
  OpenNotesExtensionAPI,
} from "@/core/extensions/types"
import { buildVaultMarkdownZip } from "@/core/export/zip"
import { copy } from "./copy"
import { ExportPanel } from "./ExportPanel"
import {
  buildCombinedHtmlDocument,
  buildMarkdownManifest,
  buildNoteHtmlDocument,
  downloadBlob,
  htmlBlob,
  htmlFilename,
  markdownBlob,
  markdownFilename,
  sanitizeArchivePath,
  zipFilename,
  type ExportNote,
} from "./exportEngine"

export type ExportCommandId =
  | "note-md"
  | "note-html"
  | "workspace-zip"
  | "workspace-html"

/**
 * Run one of the export flows. Shared by the palette commands and the
 * panel buttons so behavior (and toasts) stay identical.
 */
export async function runExport(
  commandId: ExportCommandId,
  api: OpenNotesExtensionAPI
): Promise<void> {
  try {
    switch (commandId) {
      case "note-md":
        await exportNoteMarkdown(api)
        return
      case "note-html":
        await exportNoteHtml(api)
        return
      case "workspace-zip":
        await exportWorkspaceZip(api)
        return
      case "workspace-html":
        await exportWorkspaceHtml(api)
        return
    }
  } catch {
    api.showToast(copy.toast.failed)
  }
}

/* ------------------------------------------------------------------ */
/* Export flows                                                        */
/* ------------------------------------------------------------------ */

function getActiveNoteOrToast(api: OpenNotesExtensionAPI): ExportNote | null {
  const note = api.getActiveNote()
  if (!note) {
    api.showToast(copy.toast.noActiveNote)
    return null
  }
  return note
}

function getWorkspaceNotesOrToast(api: OpenNotesExtensionAPI): ExportNote[] | null {
  const notes = api.getNotes()
  if (notes.length === 0) {
    api.showToast(copy.toast.nothingToExport)
    return null
  }
  return notes
}

async function exportNoteMarkdown(api: OpenNotesExtensionAPI): Promise<void> {
  const note = getActiveNoteOrToast(api)
  if (!note) return
  const filename = markdownFilename(note.path)
  downloadBlob(markdownBlob(note.content), filename)
  api.showToast(copy.toast.exported(filename))
}

async function exportNoteHtml(api: OpenNotesExtensionAPI): Promise<void> {
  const note = getActiveNoteOrToast(api)
  if (!note) return
  const documentHtml = await buildNoteHtmlDocument(note)
  const filename = htmlFilename(note.path)
  downloadBlob(htmlBlob(documentHtml), filename)
  api.showToast(copy.toast.exported(filename))
}

async function exportWorkspaceZip(api: OpenNotesExtensionAPI): Promise<void> {
  const notes = getWorkspaceNotesOrToast(api)
  if (!notes) return

  const now = new Date()
  // Every note as .md, folder structure preserved, plus a manifest at
  // the archive root. Reuses the tested store-only zip builder from core.
  const entries = [
    ...notes.map((note) => ({
      path: sanitizeArchivePath(note.path),
      content: note.content,
      lastModified: now,
    })),
    {
      path: "manifest.md",
      content: buildMarkdownManifest(notes, now),
      lastModified: now,
    },
  ]

  const zipBytes = buildVaultMarkdownZip(entries)
  const buffer = new ArrayBuffer(zipBytes.byteLength)
  new Uint8Array(buffer).set(zipBytes)
  const filename = zipFilename(now)
  downloadBlob(new Blob([buffer], { type: "application/zip" }), filename)
  api.showToast(copy.toast.exported(filename))
}

async function exportWorkspaceHtml(api: OpenNotesExtensionAPI): Promise<void> {
  const notes = getWorkspaceNotesOrToast(api)
  if (!notes) return
  const documentHtml = await buildCombinedHtmlDocument(notes)
  const filename = htmlFilename(copy.document.workspaceTitle)
  downloadBlob(htmlBlob(documentHtml), filename)
  api.showToast(copy.toast.exported(filename))
}

/* ------------------------------------------------------------------ */
/* Extension contract                                                  */
/* ------------------------------------------------------------------ */

export const exportExtension: OpenNotesExtension = {
  manifest: {
    id: "export",
    name: "Export",
    version: "0.1.0",
    description: "Export notes to Markdown, styled HTML, or a zip bundle.",
    author: "OpenNotes",
    defaultEnabled: true,
  },

  activate(ctx) {
    ctx.registerCommand({
      id: "note-md",
      title: "Export current note as Markdown",
      run: (api) => runExport("note-md", api),
    })

    ctx.registerCommand({
      id: "note-html",
      title: "Export current note as HTML",
      run: (api) => runExport("note-html", api),
    })

    ctx.registerCommand({
      id: "workspace-zip",
      title: "Export workspace as zip bundle",
      run: (api) => runExport("workspace-zip", api),
    })

    ctx.registerCommand({
      id: "workspace-html",
      title: "Export workspace as combined HTML",
      run: (api) => runExport("workspace-html", api),
    })

    ctx.registerPanel({
      id: "export-panel",
      title: copy.panel.title,
      icon: "Download",
      side: "right",
      component: ExportPanel,
    })
  },
}

export default exportExtension
