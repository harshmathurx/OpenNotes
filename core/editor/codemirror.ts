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
import { syntaxTree } from "@codemirror/language"
import { markdown } from "@codemirror/lang-markdown"
import { basicSetup } from "codemirror"
import { indentWithTab } from "@codemirror/commands"
import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
} from "@codemirror/autocomplete"

// ── Wikilink Widget ──
class WikilinkWidget extends WidgetType {
  constructor(
    private text: string,
    private onNavigate: (path: string) => void
  ) {
    super()
  }

  toDOM() {
    const span = document.createElement("span")
    span.className = "cm-wikilink"
    span.textContent = this.text
    span.style.cssText = `
      color: var(--sidebar-primary, #16a34a);
      text-decoration: underline;
      text-decoration-color: var(--sidebar-primary, #16a34a);
      text-underline-offset: 2px;
      cursor: pointer;
      font-weight: 500;
    `
    span.addEventListener("click", (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onNavigate(this.text)
    })
    return span
  }
}

// ── Wikilink Plugin ──
function createWikilinkPlugin(onNavigate?: (path: string) => void) {
  return ViewPlugin.fromClass(
    class WikilinkPluginValue {
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
        const regex = /\[\[([^\]]+)\]\]/g
        let match
        while ((match = regex.exec(text)) !== null) {
          const from = match.index
          const to = from + match[0].length
          builder.add(
            from,
            to,
            Decoration.replace({
              widget: new WikilinkWidget(match[1], onNavigate ?? (() => {})),
              inclusive: true,
            })
          )
        }
        this.decorations = builder.finish()
      }
    },
    { decorations: (v) => v.decorations }
  )
}

// ── Slash Command Completions ──
const slashCompletions: Completion[] = [
  { label: "/h1", displayLabel: "Heading 1", info: "Insert H1", apply: "# " },
  { label: "/h2", displayLabel: "Heading 2", info: "Insert H2", apply: "## " },
  { label: "/h3", displayLabel: "Heading 3", info: "Insert H3", apply: "### " },
  {
    label: "/bullet",
    displayLabel: "Bullet list",
    info: "Insert bullet",
    apply: "- ",
  },
  {
    label: "/num",
    displayLabel: "Numbered list",
    info: "Insert numbered list",
    apply: "1. ",
  },
  {
    label: "/quote",
    displayLabel: "Quote",
    info: "Insert blockquote",
    apply: "> ",
  },
  {
    label: "/code",
    displayLabel: "Code block",
    info: "Insert code block",
    apply: "```\n\n```",
  },
  {
    label: "/hr",
    displayLabel: "Divider",
    info: "Insert horizontal rule",
    apply: "---\n",
  },
]

function slashCommandSource(
  context: CompletionContext
): CompletionResult | null {
  const line = context.state.doc.lineAt(context.pos)
  const before = line.text.slice(0, context.pos - line.from)

  // Only trigger at start of line or after whitespace at start
  if (!before.match(/^\/?$/)) return null

  const isEmpty = before === ""
  const isSlash = before === "/"

  if (!isEmpty && !isSlash) return null

  return {
    from: line.from,
    options: slashCompletions,
    validFor: /^\/?$/, // Keep open while typing /h, /b, etc.
  }
}

// ── Dynamic file paths for wikilinks ──
const filePathsField = StateField.define<string[]>({
  create: () => [],
  update: (value, tr) => {
    for (const effect of tr.effects) {
      if (effect.is(setFilePathsEffect)) {
        return effect.value
      }
    }
    return value
  },
})

export const setFilePathsEffect = StateEffect.define<string[]>()

export function updateFilePaths(view: EditorView, paths: string[]) {
  view.dispatch({ effects: setFilePathsEffect.of(paths) })
}

// ── Wikilink Completions ──
function wikilinkSource(context: CompletionContext): CompletionResult | null {
  const filePaths = context.state.field(filePathsField, false) ?? []
  const before = context.matchBefore(/\[\[[^\]]*/)
  if (!before) return null

  const query = before.text.slice(2).toLowerCase()
  const options = filePaths
    .filter((p) => p.toLowerCase().includes(query))
    .map((p) => ({
      label: p,
      apply: `[[${p}]]`,
    }))

  if (options.length === 0 && query.length > 0) return null

  return {
    from: before.from,
    options,
    validFor: /^\[\[[^\]]*$/,
    filter: false,
  }
}

// ── Header Marker Widget ──
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
      opacity: 0.3;
      font-weight: 400;
      font-size: 0.75em;
      font-family: var(--font-sans, system-ui);
      vertical-align: middle;
    `
    return span
  }
}

// ── Markdown Syntax Hider + Code Block Styler ──
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

    // Track state
    let inFencedCode = false
    let fencedCodeDepth = 0
    let inBlockquote = false

    const cursorLine = view.state.doc.lineAt(view.state.selection.main.head)

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimmed = line.trimStart()
      const lineStartPos = pos
      const thisLineNum = view.state.doc.lineAt(
        pos + Math.floor(line.length / 2)
      ).number
      const isActiveLine = cursorLine.number === thisLineNum

      // ── Fenced Code Blocks ──
      const fenceMatch = trimmed.match(/^(```+)(.*)$/)
      if (fenceMatch) {
        const fenceLen = fenceMatch[1].length
        const indentLen = line.length - trimmed.length
        const fenceStart = lineStartPos + indentLen
        const fenceEnd = fenceStart + fenceMatch[0].length

        if (!inFencedCode) {
          inFencedCode = true
          fencedCodeDepth = fenceLen
          // Style opening fence
          builder.add(
            fenceStart,
            fenceEnd,
            Decoration.replace({
              widget: new (class extends WidgetType {
                toDOM() {
                  const el = document.createElement("span")
                  el.className = "cm-md-code-fence"
                  el.textContent = fenceMatch[0]
                  return el
                }
              })(),
              inclusive: true,
            })
          )
        } else if (fenceLen >= fencedCodeDepth) {
          inFencedCode = false
          // Style closing fence
          builder.add(
            fenceStart,
            fenceEnd,
            Decoration.replace({
              widget: new (class extends WidgetType {
                toDOM() {
                  const el = document.createElement("span")
                  el.className = "cm-md-code-fence"
                  el.textContent = fenceMatch[0]
                  return el
                }
              })(),
              inclusive: true,
            })
          )
        }
      } else if (inFencedCode) {
        // Style code content lines
        builder.add(
          lineStartPos,
          lineStartPos + line.length,
          Decoration.mark({
            class: "cm-md-code-content",
            inclusive: true,
          })
        )
      }

      // ── Blockquotes ──
      if (!inFencedCode && trimmed.startsWith("> ")) {
        const markerLen = 2
        const indentLen = line.length - trimmed.length
        builder.add(
          lineStartPos + indentLen,
          lineStartPos + indentLen + markerLen,
          Decoration.mark({
            class: "cm-md-blockquote-marker",
          })
        )
        // Style the entire blockquote line
        builder.add(
          lineStartPos,
          lineStartPos + line.length,
          Decoration.mark({
            class: "cm-md-blockquote-line",
            inclusive: true,
          })
        )
      }

      // ── Horizontal Rules ──
      if (!inFencedCode && trimmed.match(/^(---|___|\*\*\*)\s*$/)) {
        builder.add(
          lineStartPos,
          lineStartPos + line.length,
          Decoration.replace({
            widget: new (class extends WidgetType {
              toDOM() {
                const el = document.createElement("hr")
                el.className = "cm-md-hr"
                return el
              }
            })(),
            inclusive: true,
          })
        )
      }

      // ── Headers ──
      if (!inFencedCode && !isActiveLine && trimmed.match(/^#{1,3} /)) {
        const level = trimmed.match(/^(#+) /)?.[1].length || 1
        const indentLen = line.length - trimmed.length
        builder.add(
          lineStartPos + indentLen,
          lineStartPos + indentLen + level + 1,
          Decoration.replace({
            widget: new HeaderMarkerWidget(level),
          })
        )
      }

      // ── Bold markers ──
      if (!inFencedCode) {
        const boldRegex = /\*\*(.+?)\*\*/g
        let boldMatch
        while ((boldMatch = boldRegex.exec(line)) !== null) {
          builder.add(
            lineStartPos + boldMatch.index,
            lineStartPos + boldMatch.index + 2,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
          builder.add(
            lineStartPos + boldMatch.index + boldMatch[0].length - 2,
            lineStartPos + boldMatch.index + boldMatch[0].length,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
        }

        // ── Italic markers (single * not adjacent to another *) ──
        const italicRegex = /(?<!\*)\*([^*]+?)\*(?!\*)/g
        let italicMatch
        while ((italicMatch = italicRegex.exec(line)) !== null) {
          builder.add(
            lineStartPos + italicMatch.index,
            lineStartPos + italicMatch.index + 1,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
          builder.add(
            lineStartPos + italicMatch.index + italicMatch[0].length - 1,
            lineStartPos + italicMatch.index + italicMatch[0].length,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
        }

        // ── Inline code backticks ──
        const inlineCodeRegex = /`([^`]+)`/g
        let codeMatch
        while ((codeMatch = inlineCodeRegex.exec(line)) !== null) {
          builder.add(
            lineStartPos + codeMatch.index,
            lineStartPos + codeMatch.index + 1,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
          builder.add(
            lineStartPos + codeMatch.index + codeMatch[0].length - 1,
            lineStartPos + codeMatch.index + codeMatch[0].length,
            Decoration.mark({
              class: "cm-md-marker-hidden",
            })
          )
        }
      }

      // ── List markers ──
      if (!inFencedCode && trimmed.match(/^(-|\*|\d+\.) /)) {
        const markerLen = trimmed.match(/^(-|\*|\d+\.) /)?.[0].length || 2
        const indentLen = line.length - trimmed.length
        builder.add(
          lineStartPos + indentLen,
          lineStartPos + indentLen + markerLen,
          Decoration.mark({
            class: "cm-md-list-marker",
          })
        )
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
  onNavigate?: (path: string) => void
  filePaths?: string[]
}

export function createEditor(options: CreateEditorOptions): EditorView {
  const extensions = [
    basicSetup,
    markdown({ codeLanguages: [] }),
    filePathsField.init(() => options.filePaths ?? []),
    autocompletion({
      override: [slashCommandSource, wikilinkSource],
      defaultKeymap: true,
      icons: false,
    }),
    createWikilinkPlugin(options.onNavigate),
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
    EditorView.domEventHandlers({
      click: (event, view) => {
        const target = event.target as HTMLElement
        if (target.classList.contains("cm-wikilink")) {
          const path = target.textContent || ""
          if (options.onNavigate) {
            options.onNavigate(path)
          }
          return true
        }
        return false
      },
    }),
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
      // Headers
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
      // Hidden markers
      ".cm-md-marker-hidden": {
        color: "var(--muted-foreground)",
        opacity: "0.25",
        fontSize: "0.8em",
      },
      // List markers
      ".cm-md-list-marker": {
        color: "var(--muted-foreground)",
        opacity: "0.5",
      },
      // Bold / italic
      ".cm-strong": { fontWeight: "700" },
      ".cm-emphasis": { fontStyle: "italic" },
      // Inline code
      ".cm-inline-code": {
        backgroundColor: "var(--muted)",
        borderRadius: "4px",
        padding: "2px 6px",
        fontSize: "0.9em",
        color: "var(--foreground)",
      },
      // Code blocks
      ".cm-md-code-content": {
        backgroundColor: "var(--muted)",
        fontFamily: "var(--font-mono, monospace) !important",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
        padding: "0 16px",
      },
      ".cm-md-code-fence": {
        display: "inline-block",
        color: "var(--muted-foreground)",
        opacity: "0.35",
        fontSize: "0.85em",
        fontFamily: "var(--font-mono, monospace)",
        letterSpacing: "0.05em",
        width: "100%",
        padding: "0 16px",
        backgroundColor: "var(--muted)",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      },
      // Blockquotes
      ".cm-md-blockquote-line": {
        borderLeft: "3px solid var(--border)",
        paddingLeft: "12px",
        color: "var(--muted-foreground)",
        fontStyle: "italic",
        boxDecorationBreak: "clone",
        WebkitBoxDecorationBreak: "clone",
      },
      ".cm-md-blockquote-marker": {
        color: "var(--muted-foreground)",
        opacity: "0.35",
      },
      // Horizontal rules
      ".cm-md-hr": {
        border: "none",
        borderTop: "1px solid var(--border)",
        margin: "16px 0",
        height: "1px",
        backgroundColor: "var(--border)",
      },
      // Autocomplete panel
      ".cm-tooltip": {
        backgroundColor: "var(--popover, white)",
        border: "1px solid var(--border, #e7e5e4)",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
        fontFamily: "var(--font-sans, system-ui)",
        fontSize: "13px",
        overflow: "hidden",
      },
      ".cm-tooltip.cm-tooltip-autocomplete": {
        padding: "4px",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul": {
        padding: "0",
        margin: "0",
        listStyle: "none",
        maxHeight: "240px",
        overflowY: "auto",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li": {
        padding: "6px 10px",
        borderRadius: "4px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "var(--foreground, #1c1917)",
      },
      ".cm-tooltip.cm-tooltip-autocomplete > ul > li[aria-selected]": {
        backgroundColor: "var(--accent, #f5f5f4)",
        color: "var(--accent-foreground, #1c1917)",
      },
      ".cm-completionLabel": {
        fontWeight: "500",
      },
      ".cm-completionDetail": {
        color: "var(--muted-foreground, #78716c)",
        fontSize: "11px",
        marginLeft: "auto",
      },
    }),
  ]

  return new EditorView({
    state: EditorState.create({ doc: options.initialContent, extensions }),
    parent: options.parent,
  })
}
