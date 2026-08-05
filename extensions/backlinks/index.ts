/**
 * Backlinks extension.
 *
 * An Obsidian-quality backlinks + outgoing-links experience for
 * [[wikilink]]-connected notes. Contributes a right-side panel showing
 * linked mentions, outgoing links, and broken links for the active
 * note, plus commands to toggle the panel and copy backlinks as a
 * markdown list.
 */

import type { OpenNotesExtension } from "@/core/extensions/types"

import { BacklinksPanel } from "./BacklinksPanel"
import { copy } from "./copy"
import { buildLinkIndex, getBacklinks, noteDisplayName } from "./linkGraph"

export const backlinksExtension: OpenNotesExtension = {
  manifest: {
    id: "backlinks",
    name: "Backlinks",
    version: "0.1.0",
    description: "See which notes link here, and where this note links.",
    author: "OpenNotes",
    defaultEnabled: true,
  },

  activate(ctx) {
    ctx.registerPanel({
      id: "backlinks-panel",
      title: copy.panel.title,
      icon: "Link2",
      side: "right",
      component: BacklinksPanel,
    })

    ctx.registerCommand({
      id: "toggle",
      title: copy.commands.toggleTitle,
      run(api) {
        // The host owns panel visibility; the command surfaces the entry point.
        api.showToast(copy.commands.toggleToast)
      },
    })

    ctx.registerCommand({
      id: "copy",
      title: copy.commands.copyTitle,
      async run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast(copy.commands.noActiveNote)
          return
        }

        const notes = api.getNotes()
        const index = buildLinkIndex(notes)
        const backlinks = getBacklinks(index, note.path, notes)

        if (backlinks.length === 0) {
          api.showToast(copy.commands.nothingToCopy)
          return
        }

        const list = backlinks
          .map((bl) => `- [[${noteDisplayName(bl.fromPath)}]]`)
          .join("\n")

        try {
          await navigator.clipboard.writeText(list)
          api.showToast(copy.commands.copied(backlinks.length))
        } catch {
          api.showToast(copy.commands.copyFailed)
        }
      },
    })
  },
}
