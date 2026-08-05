import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"

// Mock the native bridge: no Tauri in jsdom, and we control pick results.
vi.mock("@/core/bridge/dialog", () => ({
  pickDirectory: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: vi.fn(),
}))

import { pickDirectory } from "@/core/bridge/dialog"
import {
  NOTES_FOLDER_STORAGE_KEY,
  clearNotesFolder,
  setNotesFolder,
} from "@/core/vault/notesFolder"
import { RECENT_FOLDERS_STORAGE_KEY } from "@/core/vault/recentFolders"
import { useNotesFolderActions } from "@/hooks/useNotesFolderActions"

const mockPickDirectory = vi.mocked(pickDirectory)

function setTauri(value: boolean): void {
  if (value) {
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      value: {},
      writable: true,
      configurable: true,
    })
  } else {
    // @ts-expect-error — removing the test-only Tauri marker
    delete window.__TAURI_INTERNALS__
  }
}

describe("useNotesFolderActions — browser (no Tauri)", () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotesFolder()
    setTauri(false)
    mockPickDirectory.mockReset()
    vi.mocked(toast).mockClear()
  })

  it("reports isDesktop=false and never touches the picker", async () => {
    const { result } = renderHook(() => useNotesFolderActions())
    expect(result.current.isDesktop).toBe(false)
    expect(result.current.notesFolder).toBeNull()

    let picked: string | null = "unset"
    await act(async () => {
      picked = await result.current.pickNotesFolder()
    })
    expect(picked).toBeNull()
    expect(mockPickDirectory).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(
      "Opening folders works best in the OpenNotes Mac app"
    )
    // Nothing was set or persisted.
    expect(result.current.notesFolder).toBeNull()
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBeNull()
  })
})

describe("useNotesFolderActions — desktop", () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotesFolder()
    setTauri(true)
    mockPickDirectory.mockReset()
    vi.mocked(toast).mockClear()
  })

  it("pick: sets the folder, persists, adds to recents, toasts", async () => {
    mockPickDirectory.mockResolvedValue("/Users/me/Notes")
    const { result } = renderHook(() => useNotesFolderActions())
    expect(result.current.isDesktop).toBe(true)

    let picked: string | null = null
    await act(async () => {
      picked = await result.current.pickNotesFolder()
    })

    expect(picked).toBe("/Users/me/Notes")
    await waitFor(() =>
      expect(result.current.notesFolder).toBe("/Users/me/Notes")
    )
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBe(
      "/Users/me/Notes"
    )
    expect(result.current.recentFolders).toEqual(["/Users/me/Notes"])
    expect(localStorage.getItem(RECENT_FOLDERS_STORAGE_KEY)).toBe(
      JSON.stringify(["/Users/me/Notes"])
    )
    expect(toast).toHaveBeenCalledWith("Opened Notes")
  })

  it("pick: cancel returns null silently and changes nothing", async () => {
    mockPickDirectory.mockResolvedValue(null)
    const { result } = renderHook(() => useNotesFolderActions())

    let picked: string | null = "unset"
    await act(async () => {
      picked = await result.current.pickNotesFolder()
    })

    expect(picked).toBeNull()
    expect(result.current.notesFolder).toBeNull()
    expect(result.current.recentFolders).toEqual([])
    expect(toast).not.toHaveBeenCalled()
  })

  it("switch: sets the folder, adds to recents, toasts", async () => {
    const { result } = renderHook(() => useNotesFolderActions())

    act(() => {
      result.current.switchToFolder("/Users/me/Work")
    })

    expect(result.current.notesFolder).toBe("/Users/me/Work")
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBe(
      "/Users/me/Work"
    )
    expect(result.current.recentFolders).toEqual(["/Users/me/Work"])
    expect(toast).toHaveBeenCalledWith("Switched to Work")
  })

  it("switch: recents are most-recent-first and deduped", async () => {
    const { result } = renderHook(() => useNotesFolderActions())

    act(() => {
      result.current.switchToFolder("/a")
      result.current.switchToFolder("/b")
      result.current.switchToFolder("/a")
    })

    expect(result.current.recentFolders).toEqual(["/a", "/b"])
    expect(result.current.notesFolder).toBe("/a")
  })

  it("subscription: an external setNotesFolder updates notesFolder live", async () => {
    const { result } = renderHook(() => useNotesFolderActions())
    expect(result.current.notesFolder).toBeNull()

    // Simulate another component (e.g. useVault's own state, another
    // window, or settings) changing the folder — no hook method involved.
    act(() => {
      setNotesFolder("/external/folder")
    })

    await waitFor(() =>
      expect(result.current.notesFolder).toBe("/external/folder")
    )
  })

  it("clearFolder resets the notes folder", async () => {
    const { result } = renderHook(() => useNotesFolderActions())
    act(() => {
      result.current.switchToFolder("/a")
    })
    expect(result.current.notesFolder).toBe("/a")

    act(() => {
      result.current.clearFolder()
    })
    expect(result.current.notesFolder).toBeNull()
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBeNull()
  })
})
