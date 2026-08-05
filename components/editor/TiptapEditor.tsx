"use client"

import { useEditor, EditorContent, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Image from "@tiptap/extension-image"
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react"
import { SlashCommand, slashCommandItems } from "./extensions/SlashCommand"
import { Wikilink } from "./extensions/Wikilink"
import {
  markdownToTiptapJSON,
  tiptapJSONToMarkdown,
} from "@/core/editor/markdown"
import { SlashMenu } from "./SlashMenu"
import { EditorBubbleMenu } from "./BubbleMenu"

/** Imperative surface exposed to the host for extension/editor bridging. */
export interface TiptapEditorHandle {
  /** Insert markdown at the cursor (converted into the live document). */
  insertMarkdown: (markdown: string) => void
  /** The current text selection as plain text ("" when none). */
  getSelection: () => string
  /** Replace the current selection with markdown (or insert at cursor). */
  replaceSelection: (markdown: string) => void
  /** Replace the entire document with the given markdown. */
  setMarkdown: (markdown: string) => void
}

interface TiptapEditorProps {
  docKey: string
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onNavigate?: (path: string) => void
}

/** Markdown is re-serialized from the doc at most this often while typing. */
const EMIT_DEBOUNCE_MS = 300

export const TiptapEditor = forwardRef<TiptapEditorHandle, TiptapEditorProps>(
  function TiptapEditor({ docKey, content, onChange, onSave, onNavigate }, ref) {
  const [slashMenuProps, setSlashMenuProps] = useState<{
    items: typeof slashCommandItems
    command: (item: (typeof slashCommandItems)[0]) => void
    clientRect: () => DOMRect | null
  } | null>(null)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const slashMenuPropsRef = useRef(slashMenuProps)
  const selectedIndexRef = useRef(selectedSlashIndex)
  const lastEmittedMarkdownRef = useRef(content)
  const isApplyingExternalContentRef = useRef(false)
  // Debounced onChange emit: keep the latest callbacks/editor in refs so the
  // trailing-edge timer never goes stale without re-arming on every render.
  const onChangeRef = useRef(onChange)
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRef = useRef<Editor | null>(null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  /** Serialize the live doc to markdown and push it upstream (latest wins). */
  const emitMarkdownNow = useCallback(() => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed) return
    const markdown = tiptapJSONToMarkdown(ed.getJSON())
    if (markdown === lastEmittedMarkdownRef.current) return
    lastEmittedMarkdownRef.current = markdown
    onChangeRef.current(markdown)
  }, [])

  /**
   * Trailing-edge debounce: the full getJSON + markdown conversion runs at
   * most once per EMIT_DEBOUNCE_MS while typing instead of per keystroke.
   * Persistence is debounced downstream by the vault save queue, so latency
   * here is invisible to the user — the editor state itself is immediate.
   */
  const scheduleEmit = useCallback(() => {
    if (emitTimerRef.current) clearTimeout(emitTimerRef.current)
    emitTimerRef.current = setTimeout(() => {
      emitTimerRef.current = null
      emitMarkdownNow()
    }, EMIT_DEBOUNCE_MS)
  }, [emitMarkdownNow])

  useEffect(() => {
    return () => {
      // Unmount (incl. note-switch remount via key): emit NOW so the queued
      // save holds the very latest content before React swaps to the next
      // note. The emit runs BEFORE the seed effect of the incoming content
      // (that effect is declared after the content-sync effect below), so
      // the outgoing note's markdown is safely captured in lastEmitted first.
      if (emitTimerRef.current) {
        clearTimeout(emitTimerRef.current)
        emitTimerRef.current = null
      }
      emitMarkdownNow()
    }
  }, [emitMarkdownNow])

  useEffect(() => {
    slashMenuPropsRef.current = slashMenuProps
  }, [slashMenuProps])

  useEffect(() => {
    selectedIndexRef.current = selectedSlashIndex
  }, [selectedSlashIndex])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: {
          HTMLAttributes: {
            class: "bg-muted rounded-md p-4 font-mono text-sm",
          },
        },
      }),
      Placeholder.configure({
        placeholder: "Start typing...",
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2",
        },
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "list-none pl-0",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "flex items-start gap-2",
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full",
        },
      }),
      Wikilink.configure({
        HTMLAttributes: {
          class:
            "text-primary underline underline-offset-2 cursor-pointer font-medium",
        },
      }),
      SlashCommand.configure({
        suggestion: {
          items: ({ query }: { query: string }) => {
            return slashCommandItems.filter((item) =>
              item.title.toLowerCase().includes(query.toLowerCase())
            )
          },
          render: () => {
            return {
              onStart: (props: {
                items: typeof slashCommandItems
                command: (item: (typeof slashCommandItems)[0]) => void
                clientRect: () => DOMRect | null
              }) => {
                setSlashMenuProps({
                  items: props.items,
                  command: props.command,
                  clientRect: props.clientRect,
                })
                setSelectedSlashIndex(0)
              },
              onUpdate: (props: {
                items: typeof slashCommandItems
                command: (item: (typeof slashCommandItems)[0]) => void
                clientRect: () => DOMRect | null
              }) => {
                setSlashMenuProps({
                  items: props.items,
                  command: props.command,
                  clientRect: props.clientRect,
                })
              },
              onKeyDown: (props: { event: KeyboardEvent }) => {
                const key = props.event.key
                if (key === "ArrowUp") {
                  setSelectedSlashIndex((prev) => Math.max(0, prev - 1))
                  return true
                }
                if (key === "ArrowDown") {
                  setSelectedSlashIndex((prev) => {
                    const max =
                      (slashMenuPropsRef.current?.items.length ?? 1) - 1
                    return Math.min(max, prev + 1)
                  })
                  return true
                }
                if (key === "Enter") {
                  const item =
                    slashMenuPropsRef.current?.items[selectedIndexRef.current]
                  if (item) slashMenuPropsRef.current?.command(item)
                  return true
                }
                if (key === "Escape") {
                  setSlashMenuProps(null)
                  return true
                }
                return false
              },
              onExit: () => {
                setSlashMenuProps(null)
              },
            }
          },
        },
      }),
    ],
    content: markdownToTiptapJSON(content),
    onUpdate: ({ editor: ed }) => {
      // The editor arrives via useSyncExternalStore: the onUpdate event can
      // fire BEFORE the store notifies React (so `editor` is still null in
      // the returned value). Keep the ref hot from the event payload itself
      // so the debounced emit can always read the live doc.
      editorRef.current = ed
      // Cheap per keystroke: only schedule the (debounced) serialize+emit.
      // External content swaps go through commands.setContent with
      // emitUpdate:false, so anything reaching here is user input.
      if (isApplyingExternalContentRef.current) return
      scheduleEmit()
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none h-full px-8 py-12 focus:outline-none",
      },
      handleClickOn: (_view, _pos, node) => {
        if (
          node.type.name === "text" &&
          node.marks.some((m) => m.type.name === "wikilink")
        ) {
          const mark = node.marks.find((m) => m.type.name === "wikilink")
          if (mark && onNavigate) {
            const path = mark.attrs.path as string
            onNavigate(path)
            return true
          }
        }
        return false
      },
    },
  })

  // The debounced emit reads through this so the trailing-edge timer never
  // holds a stale editor instance. Assigned during render (not in an effect)
  // so the ref is live the moment the editor exists — an effect would leave
  // one commit where a just-fired keystroke's emit saw editorRef === null.
  editorRef.current = editor
  useEffect(() => {
    return () => {
      editorRef.current = null
    }
  }, [editor])

  // Sync external content changes. Loop-proof by construction: onChange only
  // ever emits exactly `lastEmittedMarkdownRef.current`, so a parent echo of
  // our own emission early-returns here; a genuinely different external
  // value lands with emitUpdate:false and can never schedule another emit.
  useEffect(() => {
    if (!editor) return
    if (content === lastEmittedMarkdownRef.current) return

    // A content change arrived while a debounced emit is pending: the
    // pending emit holds newer text (typed a split second ago) than this
    // incoming prop (the parent's pre-typing snapshot). Flush it first so
    // lastEmitted captures the newest text, then only accept the external
    // content when it genuinely differs from what the editor already shows.
    if (emitTimerRef.current) {
      clearTimeout(emitTimerRef.current)
      emitTimerRef.current = null
      emitMarkdownNow()
    }
    if (content === lastEmittedMarkdownRef.current) return

    isApplyingExternalContentRef.current = true
    editor.commands.setContent(markdownToTiptapJSON(content), {
      emitUpdate: false,
    })
    lastEmittedMarkdownRef.current = content

    queueMicrotask(() => {
      isApplyingExternalContentRef.current = false
    })
  }, [content, editor, emitMarkdownNow])

  // Keep lastEmitted aligned with external content (note open, extension
  // writes). Declared AFTER the content-sync effect: when content changes in
  // the same commit the editor was replaced (note-switch), the sync effect
  // has already applied the new doc, so seeding here can never overwrite a
  // pending emit's newer markdown.
  useEffect(() => {
    lastEmittedMarkdownRef.current = content
  }, [content, docKey])

  // Save shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        onSave()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onSave])

  const handleSlashSelect = useCallback(
    (item: (typeof slashCommandItems)[0]) => {
      slashMenuProps?.command(item)
      setSlashMenuProps(null)
    },
    [slashMenuProps]
  )

  // Expose an imperative bridge so extensions/host can insert markdown,
  // read/replace the selection, and set the document content.
  useImperativeHandle(
    ref,
    () => ({
      insertMarkdown(markdown: string) {
        if (!editor) return
        const json = markdownToTiptapJSON(markdown)
        const nodes = json.type === "doc" ? (json.content ?? []) : [json]
        editor
          .chain()
          .focus()
          .insertContent(nodes as never)
          .run()
      },
      getSelection() {
        if (!editor) return ""
        const { from, to } = editor.state.selection
        return editor.state.doc.textBetween(from, to, " ")
      },
      replaceSelection(markdown: string) {
        if (!editor) return
        const json = markdownToTiptapJSON(markdown)
        const nodes = json.type === "doc" ? (json.content ?? []) : [json]
        const { from, to } = editor.state.selection
        editor
          .chain()
          .focus()
          .insertContentAt({ from, to }, nodes as never)
          .run()
      },
      setMarkdown(markdown: string) {
        if (!editor) return
        // Cancel any pending debounced emit: this external value is newer.
        if (emitTimerRef.current) {
          clearTimeout(emitTimerRef.current)
          emitTimerRef.current = null
        }
        isApplyingExternalContentRef.current = true
        editor.commands.setContent(markdownToTiptapJSON(markdown), {
          emitUpdate: false,
        })
        lastEmittedMarkdownRef.current = markdown
        queueMicrotask(() => {
          isApplyingExternalContentRef.current = false
        })
      },
    }),
    [editor]
  )

  if (!editor) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-y-auto">
      <EditorContent editor={editor} />

      {slashMenuProps && (
        <SlashMenu
          items={slashMenuProps.items}
          selectedIndex={selectedSlashIndex}
          onSelect={handleSlashSelect}
          onSelectIndex={setSelectedSlashIndex}
          clientRect={slashMenuProps.clientRect}
        />
      )}

      <EditorBubbleMenu editor={editor} />
    </div>
  )
  }
)
