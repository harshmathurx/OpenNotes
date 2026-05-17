"use client"

import { useEffect, useRef } from "react"
import { createEditor, updateFilePaths } from "@/core/editor/codemirror"
import type { EditorView } from "@codemirror/view"

interface EditorProps {
  content: string
  filePaths?: string[]
  onChange: (content: string) => void
  onSave: () => void
  onNavigate?: (path: string) => void
}

export function Editor({
  content,
  filePaths,
  onChange,
  onSave,
  onNavigate,
}: EditorProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onNavigateRef = useRef(onNavigate)

  // Keep refs current so the editor's captured callbacks always call latest
  onChangeRef.current = onChange
  onSaveRef.current = onSave
  onNavigateRef.current = onNavigate

  useEffect(() => {
    if (!parentRef.current || viewRef.current) return
    const view = createEditor({
      parent: parentRef.current,
      initialContent: content,
      filePaths,
      onChange: (c) => onChangeRef.current(c),
      onSave: () => onSaveRef.current(),
      onNavigate: (p) => onNavigateRef.current?.(p),
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

  useEffect(() => {
    const view = viewRef.current
    if (!view || !filePaths) return
    updateFilePaths(view, filePaths)
  }, [filePaths])

  return <div ref={parentRef} className="h-full overflow-hidden" />
}
