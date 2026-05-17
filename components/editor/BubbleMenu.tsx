"use client"

import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/react/menus"
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
} from "lucide-react"
import type { Editor } from "@tiptap/react"

interface EditorBubbleMenuProps {
  editor: Editor | null
}

export function EditorBubbleMenu({ editor }: EditorBubbleMenuProps) {
  if (!editor) return null

  return (
    <TiptapBubbleMenu editor={editor}>
      <div className="flex items-center gap-0.5 rounded-lg border bg-popover p-1 shadow-lg">
        <BubbleButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive("strike")}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive("code")}
        >
          <Code className="h-3.5 w-3.5" />
        </BubbleButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <BubbleButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          isActive={editor.isActive("heading", { level: 1 })}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          isActive={editor.isActive("heading", { level: 2 })}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </BubbleButton>
        <BubbleButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          isActive={editor.isActive("heading", { level: 3 })}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </BubbleButton>
      </div>
    </TiptapBubbleMenu>
  )
}

function BubbleButton({
  onClick,
  isActive,
  children,
}: {
  onClick: () => void
  isActive: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors ${
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {children}
    </button>
  )
}
