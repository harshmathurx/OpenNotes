/**
 * Starter template for an OpenNotes extension.
 *
 * Copy this folder to `extensions/<your-id>/`, rename things, and build.
 * See docs/extensions.md for the full guide.
 *
 * Checklist:
 *  1. Rename the folder to your extension id (kebab-case).
 *  2. Update the manifest (id, name, version, description, author).
 *  3. Implement your commands / slash items / panel.
 *  4. Register the extension in core/extensions/loader.ts.
 *  5. Add tests in tests/extensions/<your-id>.test.ts.
 *  6. Run: pnpm exec vitest run tests/extensions && pnpm exec tsc --noEmit && pnpm exec eslint extensions/<your-id>
 */

import * as React from "react"
import type {
  OpenNotesExtension,
  OpenNotesExtensionAPI,
} from "@/core/extensions/types"

// --- Optional: a dockable panel. Delete if you don't need one. ---
function StarterPanel({ api }: { api: OpenNotesExtensionAPI }) {
  const note = api.getActiveNote()
  return (
    <div className="space-y-2 p-4 text-sm">
      <p className="text-muted-foreground">
        {note ? `Active note: ${note.path}` : "Open a note to get started."}
      </p>
    </div>
  )
}

export const starterExtension: OpenNotesExtension = {
  manifest: {
    id: "starter",
    name: "Starter",
    version: "0.1.0",
    description: "A starting point for your own extension.",
    author: "You",
    defaultEnabled: true,
  },

  activate(ctx) {
    // A command in the command palette (Cmd+K).
    ctx.registerCommand({
      id: "hello",
      title: "Starter: Say hello",
      run(api) {
        api.showToast("Hello from your extension")
      },
    })

    // A slash item in the editor `/` menu.
    ctx.registerSlashItem({
      id: "timestamp",
      title: "Starter: Timestamp",
      description: "Insert the current date and time",
      insert() {
        const now = new Date()
        return now.toISOString().slice(0, 16).replace("T", " ")
      },
    })

    // A dockable side panel.
    ctx.registerPanel({
      id: "panel",
      title: "Starter",
      icon: "Puzzle",
      side: "right",
      component: StarterPanel,
    })
  },
}
