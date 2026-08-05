import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  NOTES_FOLDER_STORAGE_KEY,
  clearNotesFolder,
  getNotesFolder,
  onNotesFolderChange,
  setNotesFolder,
} from "@/core/vault/notesFolder"

const LEGACY_GIT_KEY = "opennotes-ext-storage:git-sync:repoPath"

// notesFolder holds a module-level cache hydrated once from localStorage.
// Each test file is a fresh module graph in vitest, but the cache persists
// across tests within this file — so we reset modules between tests to get a
// clean hydration for the migration cases.
async function freshModule() {
  return await import("@/core/vault/notesFolder")
}

describe("notesFolder — get/set/persist", () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotesFolder()
  })

  it("returns null when unset", () => {
    expect(getNotesFolder()).toBeNull()
  })

  it("persists to localStorage and reads back", () => {
    setNotesFolder("/notes")
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBe("/notes")
    expect(getNotesFolder()).toBe("/notes")
  })

  it("clearNotesFolder removes the persisted value", () => {
    setNotesFolder("/notes")
    clearNotesFolder()
    expect(getNotesFolder()).toBeNull()
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBeNull()
  })
})

describe("notesFolder — change events", () => {
  beforeEach(() => {
    localStorage.clear()
    clearNotesFolder()
  })

  it("emits the new path to subscribers on set", () => {
    const cb = vi.fn()
    const unsub = onNotesFolderChange(cb)
    setNotesFolder("/notes")
    expect(cb).toHaveBeenCalledWith("/notes")
    unsub()
  })

  it("emits null on clear", () => {
    setNotesFolder("/notes")
    const cb = vi.fn()
    const unsub = onNotesFolderChange(cb)
    clearNotesFolder()
    expect(cb).toHaveBeenCalledWith(null)
    unsub()
  })

  it("stops notifying after unsubscribe", () => {
    const cb = vi.fn()
    const unsub = onNotesFolderChange(cb)
    unsub()
    setNotesFolder("/notes")
    expect(cb).not.toHaveBeenCalled()
  })

  it("supports multiple subscribers", () => {
    const a = vi.fn()
    const b = vi.fn()
    const unA = onNotesFolderChange(a)
    const unB = onNotesFolderChange(b)
    setNotesFolder("/notes")
    expect(a).toHaveBeenCalledWith("/notes")
    expect(b).toHaveBeenCalledWith("/notes")
    unA()
    unB()
  })
})

describe("notesFolder — migration of the legacy git repoPath key", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("adopts the legacy git-sync repoPath when the new key is unset", async () => {
    localStorage.setItem(LEGACY_GIT_KEY, "/legacy/repo")
    const mod = await freshModule()
    expect(mod.getNotesFolder()).toBe("/legacy/repo")
    // And it is persisted under the shared key.
    expect(localStorage.getItem(NOTES_FOLDER_STORAGE_KEY)).toBe("/legacy/repo")
  })

  it("prefers the new key over the legacy one", async () => {
    localStorage.setItem(NOTES_FOLDER_STORAGE_KEY, "/new/folder")
    localStorage.setItem(LEGACY_GIT_KEY, "/legacy/repo")
    const mod = await freshModule()
    expect(mod.getNotesFolder()).toBe("/new/folder")
  })

  it("returns null when neither key is present", async () => {
    const mod = await freshModule()
    expect(mod.getNotesFolder()).toBeNull()
  })
})
