"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const view = createEditor({
      parent: parentRef.current,
      initialContent: content,
      onChange,
      onSave,
    })
    viewRef.current = view
    setReady(true)
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
