"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { pickDirectory } from "@/core/bridge/dialog"
import { isTauri } from "@/core/bridge/runtime"
import {
  clearNotesFolder,
  getNotesFolder,
  onNotesFolderChange,
  setNotesFolder,
} from "@/core/vault/notesFolder"
import {
  addRecentFolder,
  getRecentFolders,
} from "@/core/vault/recentFolders"

/** Last path segment, tolerating both macOS "/" and stray "\" separators. */
function folderName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

/**
 * useNotesFolderActions — one place that owns "pick / switch / clear the
 * notes folder" plus the recent-folders list, so the sidebar switcher, the
 * command palette, and the first-run empty state all behave identically.
 *
 * The vault reconcile (useVault) reacts to onNotesFolderChange on its own —
 * this hook only needs to call setNotesFolder and the workspace follows.
 */
export function useNotesFolderActions() {
  const isDesktop = isTauri()

  const [notesFolder, setNotesFolderState] = useState<string | null>(() =>
    getNotesFolder()
  )
  const [recentFolders, setRecentFolders] = useState<string[]>(() =>
    getRecentFolders()
  )

  // Keep notesFolder live across windows/components: any setNotesFolder or
  // clearNotesFolder call (from anywhere) flows through here.
  useEffect(
    () =>
      onNotesFolderChange((path) => {
        setNotesFolderState(path)
        // A folder was picked/switched elsewhere too — re-read the MRU so
        // the switcher's list reflects it.
        setRecentFolders(getRecentFolders())
      }),
    []
  )

  /**
   * Open the native folder picker and adopt the choice as the notes folder.
   * Returns the chosen path, or null on cancel / in the browser.
   */
  const pickNotesFolder = useCallback(async (): Promise<string | null> => {
    if (!isTauri()) {
      toast("Opening folders works best in the OpenNotes Mac app")
      return null
    }
    const path = await pickDirectory()
    if (!path) return null // cancelled — stay silent
    setNotesFolder(path)
    setRecentFolders(addRecentFolder(path))
    toast(`Opened ${folderName(path)}`)
    return path
  }, [])

  /** Switch to a folder (typically from the recents list). */
  const switchToFolder = useCallback((path: string): void => {
    setNotesFolder(path)
    setRecentFolders(addRecentFolder(path))
    toast(`Switched to ${folderName(path)}`)
  }, [])

  /** Forget the notes folder (the vault falls back to browser storage). */
  const clearFolder = useCallback((): void => {
    clearNotesFolder()
  }, [])

  return {
    notesFolder,
    recentFolders,
    isDesktop,
    pickNotesFolder,
    switchToFolder,
    clearFolder,
  }
}
