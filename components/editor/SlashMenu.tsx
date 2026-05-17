"use client"

import { useEffect, useRef } from "react"
import { slashCommandItems } from "./extensions/SlashCommand"

interface SlashMenuProps {
  items: typeof slashCommandItems
  selectedIndex: number
  onSelect: (item: (typeof slashCommandItems)[0]) => void
  onSelectIndex: (index: number) => void
  clientRect: () => DOMRect | null
}

export function SlashMenu({
  items,
  selectedIndex,
  onSelect,
  onSelectIndex,
  clientRect,
}: SlashMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const rect = clientRect()

  useEffect(() => {
    const el = itemRefs.current[selectedIndex]
    if (el) {
      el.scrollIntoView({ block: "nearest" })
    }
  }, [selectedIndex])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // Close by selecting nothing — parent handles this via onExit
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (items.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="fixed z-50 w-64 overflow-hidden rounded-lg border bg-popover shadow-lg"
      style={{
        top: rect ? rect.bottom + 8 : 0,
        left: rect ? rect.left : 0,
      }}
    >
      <div className="max-h-72 overflow-y-auto py-1">
        {items.map((item, index) => (
          <button
            key={item.title}
            ref={(el) => {
              itemRefs.current[index] = el
            }}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onSelectIndex(index)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "text-popover-foreground hover:bg-accent/50"
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-medium">
              {item.icon}
            </span>
            <div>
              <div className="font-medium">{item.title}</div>
              <div className="text-xs text-muted-foreground">
                {item.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
