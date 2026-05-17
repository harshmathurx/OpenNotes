import {
  EditorView,
  keymap,
  Decoration,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view"
import { EditorState, RangeSetBuilder } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { basicSetup } from "codemirror"
import { indentWithTab } from "@codemirror/commands"

interface CreateEditorOptions {
  parent: HTMLElement
  initialContent: string
  onChange: (content: string) => void
  onSave: () => void
}

// Custom markdown styling that makes headers bigger and syntax more subtle
const markdownStyles = ViewPlugin.fromClass(
  class {
    decorations = Decoration.none
    update(update: ViewUpdate) {
      if (!update.docChanged) return
      const builder = new RangeSetBuilder<Decoration>()
      const text = update.state.doc.toString()
      const lines = text.split("\n")
      let pos = 0
      for (const line of lines) {
        const trimmed = line.trimStart()
        // Headers: make the # marks subtle
        if (trimmed.startsWith("# ")) {
          builder.add(
            pos,
            pos + line.indexOf("# ") + 2,
            Decoration.mark({ class: "cm-md-heading-1" })
          )
        } else if (trimmed.startsWith("## ")) {
          builder.add(
            pos,
            pos + line.indexOf("## ") + 3,
            Decoration.mark({ class: "cm-md-heading-2" })
          )
        } else if (trimmed.startsWith("### ")) {
          builder.add(
            pos,
            pos + line.indexOf("### ") + 4,
            Decoration.mark({ class: "cm-md-heading-3" })
          )
        }
        // Bold markers: subtle
        const boldMatches = line.matchAll(/\*\*(.+?)\*\*/g)
        for (const match of boldMatches) {
          if (match.index !== undefined) {
            builder.add(
              pos + match.index,
              pos + match.index + 2,
              Decoration.mark({ class: "cm-md-marker" })
            )
            builder.add(
              pos + match.index + match[0].length - 2,
              pos + match.index + match[0].length,
              Decoration.mark({ class: "cm-md-marker" })
            )
          }
        }
        pos += line.length + 1
      }
      this.decorations = builder.finish()
    }
  },
  { decorations: (v) => v.decorations }
)

export function createEditor(options: CreateEditorOptions): EditorView {
  const extensions = [
    basicSetup,
    markdown({ codeLanguages: [] }),
    keymap.of([
      indentWithTab,
      {
        key: "Mod-s",
        run: () => {
          options.onSave()
          return true
        },
      },
    ]),
    EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString())
      }
    }),
    markdownStyles,
    EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "16px",
        fontFamily: "var(--font-mono, monospace)",
      },
      ".cm-content": {
        padding: "48px 32px",
        maxWidth: "720px",
        margin: "0 auto",
        fontFamily: "var(--font-mono, monospace)",
        caretColor: "var(--foreground)",
      },
      ".cm-line": {
        lineHeight: "1.75",
        padding: "2px 0",
      },
      ".cm-gutters": { display: "none" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-focused": { outline: "none" },
      ".cm-cursor": {
        borderLeftColor: "var(--foreground)",
        borderLeftWidth: "2px",
      },
      ".cm-activeLine": { backgroundColor: "transparent" },
      ".cm-selectionBackground": { backgroundColor: "var(--accent)" },
      // Markdown heading styling
      ".cm-md-heading-1": {
        fontSize: "1.75em",
        fontWeight: "700",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--foreground)",
      },
      ".cm-md-heading-2": {
        fontSize: "1.4em",
        fontWeight: "600",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--foreground)",
      },
      ".cm-md-heading-3": {
        fontSize: "1.15em",
        fontWeight: "600",
        fontFamily: "var(--font-sans, sans-serif)",
        color: "var(--foreground)",
      },
      ".cm-md-marker": { color: "var(--muted-foreground)", opacity: "0.5" },
      // Code blocks
      ".cm-code": {
        backgroundColor: "var(--muted)",
        borderRadius: "4px",
        padding: "0 4px",
      },
    }),
  ]

  return new EditorView({
    state: EditorState.create({ doc: options.initialContent, extensions }),
    parent: options.parent,
  })
}
