"use client"

import { useState, useCallback } from "react"

const STYLE_STORAGE_KEY = "opennotes-editor-styles"

export interface EditorStyles {
  fontFamily: "sans" | "serif" | "mono"
  fontSize: number
  lineHeight: number
  editorWidth: "narrow" | "medium" | "wide"
}

const DEFAULT_STYLES: EditorStyles = {
  fontFamily: "sans",
  fontSize: 16,
  lineHeight: 1.6,
  editorWidth: "medium",
}

export function useEditorStyles() {
  const [styles, setStyles] = useState<EditorStyles>(() => {
    if (typeof window === "undefined") return DEFAULT_STYLES
    try {
      const saved = window.localStorage.getItem(STYLE_STORAGE_KEY)
      return saved ? { ...DEFAULT_STYLES, ...JSON.parse(saved) } : DEFAULT_STYLES
    } catch (e) {
      console.error("Failed to load editor styles", e)
      return DEFAULT_STYLES
    }
  })

  const saveStyles = useCallback((newStyles: Partial<EditorStyles>) => {
    setStyles((prev) => {
      const updated = { ...prev, ...newStyles }
      localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const getStyleObject = useCallback(() => {
    const fontClass =
      styles.fontFamily === "serif"
        ? "font-serif"
        : styles.fontFamily === "mono"
          ? "font-mono"
          : "font-sans"

    const widthClass =
      styles.editorWidth === "narrow"
        ? "max-w-2xl"
        : styles.editorWidth === "wide"
          ? "max-w-none"
          : "max-w-4xl"

    return {
      style: {
        fontSize: `${styles.fontSize}px`,
        lineHeight: `${styles.lineHeight}`,
      },
      fontClass,
      widthClass,
    }
  }, [styles])

  return {
    styles,
    saveStyles,
    getStyleObject,
  }
}
