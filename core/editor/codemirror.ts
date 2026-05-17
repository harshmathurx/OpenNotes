import { EditorView, keymap } from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { basicSetup } from "codemirror"
import { indentWithTab } from "@codemirror/commands"

interface CreateEditorOptions {
  parent: HTMLElement
  initialContent: string
  onChange: (content: string) => void
  onSave: () => void
  darkMode?: boolean
}

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
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        options.onChange(update.state.doc.toString())
      }
    }),
    EditorView.theme({
      "&": {
        height: "100%",
        fontSize: "16px",
        fontFamily: "var(--font-mono, monospace)",
      },
      ".cm-content": {
        padding: "32px",
        maxWidth: "720px",
        margin: "0 auto",
        fontFamily: "var(--font-mono, monospace)",
      },
      ".cm-line": { lineHeight: "1.7", padding: "2px 0" },
      ".cm-gutters": { display: "none" },
      ".cm-scroller": { overflow: "auto" },
      ".cm-focused": { outline: "none" },
      ".cm-cursor": { borderLeftColor: "var(--foreground)" },
      ".cm-activeLine": { backgroundColor: "transparent" },
      ".cm-selectionBackground": { backgroundColor: "var(--accent)" },
    }),
  ]

  return new EditorView({
    state: EditorState.create({ doc: options.initialContent, extensions }),
    parent: options.parent,
  })
}
