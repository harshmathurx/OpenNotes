"use client"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useEditorStyles } from "@/hooks/useEditorStyles"
import { Type, Move, Sparkles } from "lucide-react"

export function StylingStudio() {
  const { styles, saveStyles } = useEditorStyles()

  return (
    <Popover>
      <PopoverTrigger
        className="group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none hover:bg-muted hover:text-foreground h-7 w-7 p-0 text-muted-foreground cursor-pointer"
        title="Tuning & Styling Studio"
      >
        <Type className="h-4 w-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 border-border/80 bg-background/95 backdrop-blur-md p-4 shadow-2xl space-y-4">
        
        {/* Header */}
        <div className="flex items-center gap-1.5 font-bold text-xs text-primary border-b pb-2">
          <Sparkles className="h-4 w-4 text-violet-500 animate-pulse" />
          <span>Styling Studio</span>
        </div>

        {/* Font Family Selection */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Font Preset
          </label>
          <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-lg">
            {(["sans", "serif", "mono"] as const).map((font) => (
              <button
                key={font}
                onClick={() => saveStyles({ fontFamily: font })}
                className={`rounded py-1 text-xs font-semibold capitalize transition-all duration-150 cursor-pointer ${
                  styles.fontFamily === font
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {font}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Font Size</span>
            <span className="font-mono text-xs text-foreground/80 font-bold">
              {styles.fontSize}px
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="14"
              max="22"
              step="1"
              value={styles.fontSize}
              onChange={(e) => saveStyles({ fontSize: parseInt(e.target.value) })}
              className="w-full h-1 bg-muted/65 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Line Height Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            <span>Line Spacing</span>
            <span className="font-mono text-xs text-foreground/80 font-bold">
              {styles.lineHeight}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1.4"
              max="2.2"
              step="0.1"
              value={styles.lineHeight}
              onChange={(e) => saveStyles({ lineHeight: parseFloat(e.target.value) })}
              className="w-full h-1 bg-muted/65 rounded-lg appearance-none cursor-pointer accent-violet-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Editor Page Width Options */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Move className="h-3 w-3" />
            <span>Canvas Width</span>
          </label>
          <div className="grid grid-cols-3 gap-1 bg-muted/40 p-1 rounded-lg">
            {(["narrow", "medium", "wide"] as const).map((width) => (
              <button
                key={width}
                onClick={() => saveStyles({ editorWidth: width })}
                className={`rounded py-1 text-xs font-semibold capitalize transition-all duration-150 cursor-pointer ${
                  styles.editorWidth === width
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {width}
              </button>
            ))}
          </div>
        </div>

      </PopoverContent>
    </Popover>
  )
}
