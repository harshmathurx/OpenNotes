/**
 * Factory for the API surface handed to extensions.
 *
 * The host app (AppShell/Tiptap wiring, done by the integrator) supplies
 * real implementations for the note/editor/toast handlers. When no
 * handler is provided the API degrades gracefully: `getActiveNote`
 * returns null, `insertIntoActiveNote` no-ops, `showToast` logs.
 *
 * `storage` is namespaced per extension id via the `extensionId`
 * context field, backed by localStorage under
 * `opennotes-ext-storage:${extensionId}:${key}` — plain strings only,
 * no secrets.
 */

import type { OpenNotesExtensionAPI } from "./types"

export interface ExtensionAPIContext {
  extensionId: string
  getActiveNote?: () => { path: string; content: string } | null
  getNotes?: () => Array<{ path: string; content: string }>
  openNote?: (path: string) => void
  createNote?: (name?: string) => Promise<string | null>
  getSelection?: () => string
  replaceSelection?: (markdown: string) => void
  insertIntoActiveNote?: (markdown: string) => void
  setActiveNoteContent?: (markdown: string) => void
  showToast?: (message: string) => void
  ai?: {
    available(): boolean
    complete(prompt: string, options?: { system?: string }): Promise<string>
  }
}

const STORAGE_PREFIX = "opennotes-ext-storage"

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function buildAPI(context: ExtensionAPIContext): OpenNotesExtensionAPI {
  const { extensionId } = context
  const storageKey = (key: string) => `${STORAGE_PREFIX}:${extensionId}:${key}`

  return {
    getActiveNote() {
      try {
        return context.getActiveNote?.() ?? null
      } catch {
        return null
      }
    },

    getNotes() {
      try {
        return context.getNotes?.() ?? []
      } catch {
        return []
      }
    },

    openNote(path: string) {
      try {
        context.openNote?.(path)
      } catch {
        // Navigation unavailable — no-op.
      }
    },

    async createNote(name?: string) {
      try {
        return (await context.createNote?.(name)) ?? null
      } catch {
        return null
      }
    },

    getSelection() {
      try {
        return context.getSelection?.() ?? ""
      } catch {
        return ""
      }
    },

    replaceSelection(markdown: string) {
      try {
        context.replaceSelection?.(markdown)
      } catch {
        // Selection replacement unsupported — no-op.
      }
    },

    insertIntoActiveNote(markdown: string) {
      try {
        context.insertIntoActiveNote?.(markdown)
      } catch {
        // Editor wiring absent or failed — insertion is a no-op by design.
      }
    },

    setActiveNoteContent(markdown: string) {
      try {
        context.setActiveNoteContent?.(markdown)
      } catch {
        // Content replacement unsupported — no-op.
      }
    },

    showToast(message: string) {
      try {
        if (context.showToast) {
          context.showToast(message)
        }
      } catch {
        // Toast host missing — swallow; extensions must never crash the app.
      }
    },

    ...(context.ai
      ? {
          ai: {
            available(): boolean {
              try {
                return context.ai?.available() ?? false
              } catch {
                return false
              }
            },
            complete(prompt: string, options?: { system?: string }): Promise<string> {
              if (!context.ai) {
                return Promise.reject(new Error("AI is not available in this app."))
              }
              return context.ai.complete(prompt, options)
            },
          },
        }
      : {}),

    storage: {
      get(key: string): string | null {
        const storage = safeLocalStorage()
        if (!storage) return null
        try {
          return storage.getItem(storageKey(key))
        } catch {
          return null
        }
      },
      set(key: string, value: string): void {
        const storage = safeLocalStorage()
        if (!storage) return
        try {
          storage.setItem(storageKey(key), value)
        } catch {
          // Quota failures are non-fatal.
        }
      },
    },
  }
}
