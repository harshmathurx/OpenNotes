/**
 * AI Co-Writer extension.
 *
 * The AI pillar of OpenNotes, shipped as an OPTIONAL extension and
 * disabled by default. The product thesis is a calm, vanilla writing app
 * first — the co-writer is there for people who want it, invisible to
 * people who don't. Bring-your-own-key (Anthropic/OpenAI) or fully-local
 * Ollama; keys are encrypted on device, never on a server.
 *
 * The heavy lifting (streaming UI, model picker, presets, error trust)
 * lives in components/editor/CoWriterPanel.tsx — this extension wraps it
 * in the panel contract and bridges the host editor selection/insert.
 */

import * as React from "react"
import type {
  OpenNotesExtension,
  OpenNotesExtensionAPI,
} from "@/core/extensions/types"
import { CoWriterPanel } from "@/components/editor/CoWriterPanel"

interface PanelProps {
  api: OpenNotesExtensionAPI
}

function AICowriterPanel({ api }: PanelProps) {
  const [open, setOpen] = React.useState(true)
  const selection = api.getSelection?.() ?? ""
  const contextBefore = api.getActiveNote()?.content ?? ""

  const handleInsert = React.useCallback(
    (text: string) => {
      api.insertIntoActiveNote(text)
    },
    [api]
  )

  const handleReplace = React.useCallback(
    (text: string) => {
      if (api.replaceSelection) {
        api.replaceSelection(text)
      } else {
        api.insertIntoActiveNote(text)
      }
    },
    [api]
  )

  const handleClose = React.useCallback(() => {
    setOpen(false)
    // Give the host a beat to unmount before resetting for next open.
    window.setTimeout(() => setOpen(true), 300)
  }, [])

  if (!open) return null

  return (
    <div className="relative h-full">
      <CoWriterPanel
        selectionText={selection}
        editorContextBefore={contextBefore}
        onInsert={handleInsert}
        onReplace={handleReplace}
        onClose={handleClose}
      />
    </div>
  )
}

export const aiCowriterExtension: OpenNotesExtension = {
  manifest: {
    id: "ai-cowriter",
    name: "AI Co-Writer",
    version: "0.1.0",
    description:
      "An optional writing partner on your own API key or local model. Off by default.",
    author: "OpenNotes",
    // Opt-in: the app stays a calm vanilla writing tool unless enabled.
    defaultEnabled: false,
  },

  activate(ctx) {
    ctx.registerPanel({
      id: "cowriter",
      title: "AI Co-Writer",
      icon: "Sparkles",
      side: "right",
      component: AICowriterPanel,
    })

    ctx.registerCommand({
      id: "open",
      title: "Open AI Co-Writer",
      run(api) {
        api.showToast("Open the AI Co-Writer panel from the panel switcher")
      },
    })

    ctx.registerCommand({
      id: "continue-writing",
      title: "AI: Continue writing",
      async run(api) {
        if (!api.ai || !api.ai.available()) {
          api.showToast("Add your API key in AI settings to use the Co-Writer")
          return
        }
        const note = api.getActiveNote()
        if (!note) {
          api.showToast("No active note")
          return
        }
        try {
          const text = await api.ai.complete(
            `Continue this note smoothly, maintaining the style:\n\n${note.content}`
          )
          api.insertIntoActiveNote(text)
        } catch {
          api.showToast("The Co-Writer couldn't finish that. Check your key or model.")
        }
      },
    })
  },
}
