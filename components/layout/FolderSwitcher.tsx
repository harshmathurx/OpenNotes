"use client"

import { Check, ChevronDown, Folder, FolderOpen } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useNotesFolderActions } from "@/hooks/useNotesFolderActions"
import { cn } from "@/lib/utils"

/** Last path segment, tolerating both macOS "/" and stray "\" separators. */
function folderName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * FolderSwitcher — the sidebar's "which notes folder am I in" control.
 *
 * A calm, compact dropdown in the sidebar header. Shows the current folder
 * name (or "Local (browser)" when none is set); the menu lists recent
 * folders with the active one checkmarked — clicking switches, which flows
 * setNotesFolder → onNotesFolderChange → the vault reconciles from disk.
 *
 * Degrades honestly in the browser: same trigger, but the menu leads with
 * an "Open folder" action that explains the Mac app is where folders work.
 */
export function FolderSwitcher() {
  const {
    notesFolder,
    recentFolders,
    isDesktop,
    pickNotesFolder,
    switchToFolder,
  } = useNotesFolderActions()

  const current = notesFolder ? folderName(notesFolder) : "Local (browser)"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Notes folder"
        className={cn(
          "flex h-7 min-w-0 items-center gap-1.5 rounded-md px-2 text-[12px] text-muted-foreground/80 outline-none transition-colors hover:bg-accent/60 hover:text-foreground data-open:bg-accent/60 data-open:text-foreground"
        )}
      >
        {notesFolder ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="max-w-28 truncate">{current}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {recentFolders.length > 0 && (
          <>
            <DropdownMenuLabel>Recent folders</DropdownMenuLabel>
            {recentFolders.map((path) => {
              const active = path === notesFolder
              return (
                <DropdownMenuItem
                  key={path}
                  disabled={active}
                  onClick={() => switchToFolder(path)}
                >
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{folderName(path)}</span>
                    <span className="truncate text-[11px] text-muted-foreground/70">
                      {path}
                    </span>
                  </span>
                  {active && (
                    <Check
                      aria-label="Current folder"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => void pickNotesFolder()}>
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {recentFolders.length > 0 ? "Open another folder…" : "Open folder…"}
        </DropdownMenuItem>
        {!isDesktop && (
          <p className="px-1.5 py-1 text-[11px] leading-relaxed text-muted-foreground/70">
            Folder sync works best in the OpenNotes Mac app.
          </p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
