import { beforeEach, describe, expect, it } from "vitest"
import {
  MAX_RECENT_FOLDERS,
  RECENT_FOLDERS_STORAGE_KEY,
  addRecentFolder,
  clearRecentFolders,
  getRecentFolders,
  removeRecentFolder,
} from "@/core/vault/recentFolders"

describe("recentFolders — get/add", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns [] when unset", () => {
    expect(getRecentFolders()).toEqual([])
  })

  it("adds a folder and reads it back", () => {
    addRecentFolder("/notes")
    expect(getRecentFolders()).toEqual(["/notes"])
  })

  it("is most-recent-first", () => {
    addRecentFolder("/a")
    addRecentFolder("/b")
    addRecentFolder("/c")
    expect(getRecentFolders()).toEqual(["/c", "/b", "/a"])
  })

  it("dedupes: re-adding an existing path moves it to the front", () => {
    addRecentFolder("/a")
    addRecentFolder("/b")
    addRecentFolder("/a")
    expect(getRecentFolders()).toEqual(["/a", "/b"])
  })

  it(`caps the list at ${MAX_RECENT_FOLDERS}`, () => {
    for (let i = 0; i < MAX_RECENT_FOLDERS + 4; i++) {
      addRecentFolder(`/folder-${i}`)
    }
    const folders = getRecentFolders()
    expect(folders).toHaveLength(MAX_RECENT_FOLDERS)
    expect(folders[0]).toBe(`/folder-${MAX_RECENT_FOLDERS + 3}`)
    // The oldest entries fell off the end.
    expect(folders).not.toContain("/folder-0")
    expect(folders).not.toContain("/folder-3")
  })

  it("ignores empty paths", () => {
    addRecentFolder("")
    expect(getRecentFolders()).toEqual([])
  })
})

describe("recentFolders — remove/clear", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("removes a path", () => {
    addRecentFolder("/a")
    addRecentFolder("/b")
    removeRecentFolder("/a")
    expect(getRecentFolders()).toEqual(["/b"])
  })

  it("remove is a no-op when the path is absent", () => {
    addRecentFolder("/a")
    removeRecentFolder("/nope")
    expect(getRecentFolders()).toEqual(["/a"])
  })

  it("clearRecentFolders empties the list and storage", () => {
    addRecentFolder("/a")
    addRecentFolder("/b")
    clearRecentFolders()
    expect(getRecentFolders()).toEqual([])
    expect(localStorage.getItem(RECENT_FOLDERS_STORAGE_KEY)).toBeNull()
  })
})

describe("recentFolders — persistence", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("roundtrips through localStorage under the documented key", () => {
    addRecentFolder("/a")
    addRecentFolder("/b")
    expect(localStorage.getItem(RECENT_FOLDERS_STORAGE_KEY)).toBe(
      JSON.stringify(["/b", "/a"])
    )
    // A fresh read (as another component/window would do) sees the same list.
    expect(getRecentFolders()).toEqual(["/b", "/a"])
  })

  it("tolerates corrupt stored JSON", () => {
    localStorage.setItem(RECENT_FOLDERS_STORAGE_KEY, "{not json")
    expect(getRecentFolders()).toEqual([])
  })

  it("tolerates a stored value of the wrong shape", () => {
    localStorage.setItem(RECENT_FOLDERS_STORAGE_KEY, JSON.stringify(42))
    expect(getRecentFolders()).toEqual([])
    localStorage.setItem(
      RECENT_FOLDERS_STORAGE_KEY,
      JSON.stringify(["/ok", 7, null])
    )
    expect(getRecentFolders()).toEqual([])
  })

  it("defensively dedupes and caps a drifted stored value", () => {
    const drifted = ["/a", "/a", ...Array.from({ length: 10 }, (_, i) => `/x${i}`)]
    localStorage.setItem(RECENT_FOLDERS_STORAGE_KEY, JSON.stringify(drifted))
    const folders = getRecentFolders()
    expect(folders[0]).toBe("/a")
    expect(new Set(folders).size).toBe(folders.length)
    expect(folders.length).toBeLessThanOrEqual(MAX_RECENT_FOLDERS)
  })
})
