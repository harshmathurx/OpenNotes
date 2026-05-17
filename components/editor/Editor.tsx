"use client"

import { useEffect, useRef, useState } from "react"
import { createEditor } from "@/core/editor/codemirror"
import type { EditorView } from "@codemirror/view"

interface EditorProps {
  content: string
  onChange: (content: string) => void
  onSave: () => void
}

export function Editor({ content, onChange, onSave }: EditorProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted || !parentRef.current || viewRef.current) return

    const view = createEditor({
      parent: parentRef.current,
      initialContent: content,
      onChange,
      onSave,
    })

    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [mounted])

  useEffect(() => {
    const view = viewRef.current
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        scrollIntoView: false,
      })
    }
  }, [content])

  if (!mounted) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading editor...</p>
      </div>
    )
  }

  return <div ref={parentRef} className="h-full overflow-hidden" />
}
