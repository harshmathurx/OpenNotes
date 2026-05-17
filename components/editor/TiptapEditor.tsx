"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Link from "@tiptap/extension-link"
import TaskList from "@tiptap/extension-task-list"
import TaskItem from "@tiptap/extension-task-item"
import Image from "@tiptap/extension-image"
import { useEffect, useState, useRef, useCallback } from "react"
import { SlashCommand, slashCommandItems } from "./extensions/SlashCommand"
import { Wikilink } from "./extensions/Wikilink"
import {
  markdownToTiptapJSON,
  tiptapJSONToMarkdown,
} from "@/core/editor/markdown"
import { SlashMenu } from "./SlashMenu"
import { EditorBubbleMenu } from "./BubbleMenu"

interface TiptapEditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
  onNavigate?: (path: string) => void
}

export function TiptapEditor({
  content,
  onChange,
  onSave,
  onNavigate,
}: TiptapEditorProps) {
  const [slashMenuProps, setSlashMenuProps] = useState<{
    items: typeof slashCommandItems
    command: (item: (typeof slashCommandItems)[0]) => void
    clientRect: () => DOMRect | null
  } | null>(null)
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const slashMenuPropsRef = useRef(slashMenuProps)
  const selectedIndexRef = useRef(selectedSlashIndex)

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
      const json = ed.getJSON()
      const markdown = tiptapJSONToMarkdown(json)
      onChange(markdown)
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

  // Sync external content changes
  useEffect(() => {
    if (!editor) return
    const current = tiptapJSONToMarkdown(editor.getJSON())
    if (current !== content) {
      editor.commands.setContent(markdownToTiptapJSON(content))
    }
  }, [content, editor])

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
