/**
 * Sample extension: Word Goals.
 *
 * Lets the user set a per-note word goal and check progress. Goals are
 * stored in the extension's namespaced storage (localStorage), keyed by
 * note path. Demonstrates: getActiveNote, showToast, storage.
 */

import type { OpenNotesExtension } from "@/core/extensions/types"

function countWords(markdown: string): number {
  return markdown
    .replace(/[#>*`_~\-[\]()!]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length
}

const goalKey = (path: string) => `goal:${path}`

export const wordGoalsExtension: OpenNotesExtension = {
  manifest: {
    id: "word-goals",
    name: "Word Goals",
    version: "0.1.0",
    description: "Set a word goal for the current note and track progress.",
    author: "OpenNotes (built-in sample)",
  },

  activate(ctx) {
    ctx.registerCommand({
      id: "set-word-goal",
      title: "Set word goal for this note",
      run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast("No active note")
          return
        }

        const raw = window.prompt(
          "Word goal for this note:",
          api.storage.get(goalKey(note.path)) ?? "500"
        )
        if (raw === null) return

        const goal = Number.parseInt(raw, 10)
        if (!Number.isFinite(goal) || goal <= 0) {
          api.showToast("Please enter a positive number")
          return
        }

        api.storage.set(goalKey(note.path), String(goal))
        const words = countWords(note.content)
        api.showToast(`Goal set: ${words}/${goal} words`)
      },
    })

    ctx.registerCommand({
      id: "show-word-goal",
      title: "Show word goal progress for this note",
      run(api) {
        const note = api.getActiveNote()
        if (!note) {
          api.showToast("No active note")
          return
        }

        const stored = api.storage.get(goalKey(note.path))
        if (!stored) {
          api.showToast("No word goal set for this note")
          return
        }

        const goal = Number.parseInt(stored, 10)
        const words = countWords(note.content)
        const percent = Math.min(100, Math.round((words / goal) * 100))
        api.showToast(
          words >= goal
            ? `Goal reached: ${words}/${goal} words`
            : `${words}/${goal} words (${percent}%)`
        )
      },
    })
  },
}
