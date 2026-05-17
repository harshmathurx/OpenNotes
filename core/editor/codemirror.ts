import {
  EditorView,
  keymap,
  Decoration,
  WidgetType,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view"
import {
  EditorState,
  RangeSetBuilder,
  StateField,
  StateEffect,
} from "@codemirror/state"
import { markdown } from "@codemirror/lang-markdown"
import { basicSetup } from "codemirror"
import { indentWithTab } from "@codemirror/commands"

// Slash command menu widget
class SlashMenuWidget extends WidgetType {
  constructor(
    private options: Array<{ label: string; shortcut: string; insert: string }>
  ) {
    super()
  }

  toDOM() {
    const div = document.createElement("div")
    div.className = "cm-slash-menu"
    div.style.cssText = `
      position: absolute;
      background: var(--popover, white);
      border: 1px solid var(--border, #e7e5e4);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 4px;
      min-width: 180px;
      z-index: 100;
      font-family: var(--font-sans, system-ui);
      font-size: 13px;
    `

    this.options.forEach((opt) => {
      const item = document.createElement("div")
      item.className = "cm-slash-item"
      item.style.cssText = `
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--foreground, #1c1917);
      `
      item.innerHTML = `<span>${opt.label}</span><kbd style="font-size: 10px; background: var(--muted, #f5f5f4); padding: 2px 4px; border-radius: 3px; color: var(--muted-foreground, #78716c);">${opt.shortcut}</kbd>`
      item.addEventListener("mouseenter", () => {
        item.style.background = "var(--accent, #f5f5f4)"
      })
      item.addEventListener("mouseleave", () => {
        item.style.background = "transparent"
      })
      div.appendChild(item)
    })

    return div
  }
}

const slashOptions = [
  { label: "Heading 1", shortcut: "h1", insert: "# " },
  { label: "Heading 2", shortcut: "h2", insert: "## " },
  { label: "Heading 3", shortcut: "h3", insert: "### " },
  { label: "Bullet list", shortcut: "bullet", insert: "- " },
  { label: "Numbered list", shortcut: "num", insert: "1. " },
  { label: "Quote", shortcut: "quote", insert: "> " },
  { label: "Code block", shortcut: "code", insert: "```\n\n```" },
  { label: "Divider", shortcut: "hr", insert: "---\n" },
]

// Show/hide slash menu effect
const showSlashMenu = StateEffect.define<boolean>()
const slashMenuField = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const e of tr.effects) if (e.is(showSlashMenu)) return e.value
    if (tr.docChanged) {
      const pos = tr.state.selection.main.head
      const line = tr.state.doc.lineAt(pos)
      const before = line.text.slice(0, pos - line.from)
      if (!before.match(/^\/?$/)) return false
    }
    return value
  },
})

class SlashMenuPluginValue {
  decorations = Decoration.none

  constructor(view: EditorView) {
    this.compute(view)
  }

  update(update: ViewUpdate) {
    this.compute(update.view)
  }

  private compute(view: EditorView) {
    const show = view.state.field(slashMenuField, false)
    if (!show) {
      this.decorations = Decoration.none
      return
    }

    const pos = view.state.selection.main.head
    const line = view.state.doc.lineAt(pos)
    const before = line.text.slice(0, pos - line.from)

    if (before === "/") {
      const builder = new RangeSetBuilder<Decoration>()
      const widget = new SlashMenuWidget(slashOptions)
      builder.add(pos, pos, Decoration.widget({ widget, side: 1 }))
      this.decorations = builder.finish()
    } else {
      this.decorations = Decoration.none
    }
  }
}

const slashMenuPlugin = ViewPlugin.fromClass(SlashMenuPluginValue, {
  decorations: (v) => v.decorations,
})

// Key handler for slash menu
const slashKeymap = keymap.of([
  {
    key: "/",
    run: (view) => {
      const pos = view.state.selection.main.head
      const line = view.state.doc.lineAt(pos)
      const before = line.text.slice(0, pos - line.from)
      if (before === "") {
        view.dispatch({ effects: showSlashMenu.of(true) })
      }
      return false
    },
  },
  {
    key: "Escape",
    run: (view) => {
      view.dispatch({ effects: showSlashMenu.of(false) })
      return true
    },
  },
])

// Markdown syntax hiding for headers
class HeaderMarkerWidget extends WidgetType {
  constructor(private level: number) {
    super()
  }
  toDOM() {
    const span = document.createElement("span")
    span.className = `cm-md-header-marker-${this.level}`
    span.textContent = "#".repeat(this.level) + " "
    span.style.cssText = `
      color: var(--muted-foreground, #78716c);
      opacity: 0.4;
      font-weight: 400;
      font-family: var(--font-sans, system-ui);
    `
    return span
  }
}

class SyntaxHiderValue {
  decorations = Decoration.none

  constructor(view: EditorView) {
    this.compute(view)
  }

  update(update: ViewUpdate) {
    this.compute(update.view)
  }

  private compute(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()
    const text = view.state.doc.toString()
    const lines = text.split("\n")
    let pos = 0

    for (const line of lines) {
      const trimmed = line.trimStart()
      const cursorLine = view.state.doc.lineAt(view.state.selection.main.head)
      const thisLine = view.state.doc.lineAt(pos + Math.floor(line.length / 2))
      const isActiveLine = cursorLine.number === thisLine.number

      if (!isActiveLine && trimmed.match(/^#{1,3} /)) {
        const level = trimmed.match(/^(#+) /)?.[1].length || 1
        const indentLen = line.length - trimmed.length
        builder.add(
          pos + indentLen,
          pos + indentLen + level + 1,
          Decoration.replace({
            widget: new HeaderMarkerWidget(level),
          })
        )
      }

      const boldMatches = [...line.matchAll(/\*\*(.+?)\*\*/g)]
      for (const match of boldMatches) {
        if (match.index !== undefined) {
          builder.add(
            pos + match.index,
            pos + match.index + 2,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
          builder.add(
            pos + match.index + match[0].length - 2,
            pos + match.index + match[0].length,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
        }
      }

      pos += line.length + 1
    }

    this.decorations = builder.finish()
  }
}

const syntaxHider = ViewPlugin.fromClass(SyntaxHiderValue, {
  decorations: (v) => v.decorations,
})

interface CreateEditorOptions {
  parent: HTMLElement
  initialContent: string
  onChange: (content: string) => void
  onSave: () => void
}

export function createEditor(options: CreateEditorOptions): EditorView {
  const extensions = [
    basicSetup,
    markdown({ codeLanguages: [] }),
    slashMenuField,
    slashMenuPlugin,
    slashKeymap,
    syntaxHider,
    keymap.of([
      indentWithTab,
      {
        key: "Mod-s",
        run: () => {
          options.onSave()
          return true
        },
      },
      {
        key: "Mod-b",
        run: (view) => {
          const { from, to } = view.state.selection.main
          if (from === to) return false
          const text = view.state.sliceDoc(from, to)
          view.dispatch({ changes: { from, to, insert: `**${text}**` } })
          return true
        },
      },
      {
        key: "Mod-i",
        run: (view) => {
          const { from, to } = view.state.selection.main
          if (from === to) return false
          const text = view.state.sliceDoc(from, to)
          view.dispatch({ changes: { from, to, insert: `*${text}*` } })
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
      ".cm-md-header-1": {
        fontSize: "1.75em",
        fontWeight: "700",
        fontFamily: "var(--font-sans, sans-serif)",
      },
      ".cm-md-header-2": {
        fontSize: "1.4em",
        fontWeight: "600",
        fontFamily: "var(--font-sans, sans-serif)",
      },
      ".cm-md-header-3": {
        fontSize: "1.15em",
        fontWeight: "600",
        fontFamily: "var(--font-sans, sans-serif)",
      },
      ".cm-md-marker-hidden": {
        color: "var(--muted-foreground)",
        opacity: "0.3",
        fontSize: "0.85em",
      },
      ".cm-strong": { fontWeight: "700" },
      ".cm-emphasis": { fontStyle: "italic" },
      ".cm-inline-code": {
        backgroundColor: "var(--muted)",
        borderRadius: "3px",
        padding: "0 4px",
        fontSize: "0.9em",
      },
    }),
  ]

  return new EditorView({
    state: EditorState.create({ doc: options.initialContent, extensions }),
    parent: options.parent,
  })
}
