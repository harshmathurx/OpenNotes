"use client"

import { useEffect, useRef } from "react"
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
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)

  // Keep refs current so the editor's captured callbacks always call latest
  onChangeRef.current = onChange
  onSaveRef.current = onSave

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const view = createEditor({
      parent: parentRef.current,
      initialContent: content,
      onChange: (c) => onChangeRef.current(c),
      onSave: () => onSaveRef.current(),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (content !== current) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content },
        scrollIntoView: false,
      })
    }
  }, [content])

  return <div ref={parentRef} className="h-full overflow-hidden" />
}
