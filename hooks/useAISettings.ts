"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { loadSecrets, migrateLegacyPlaintextKeys, saveSecrets } from "@/core/crypto/keys"

const STORAGE_KEY = "opennotes-ai-config"

export interface AISettings {
  provider: "anthropic" | "openai" | "ollama"
  anthropicKey: string
  openaiKey: string
  ollamaUrl: string
}

const DEFAULT_SETTINGS: AISettings = {
  provider: "anthropic",
  anthropicKey: "",
  openaiKey: "",
  ollamaUrl: "http://localhost:11434",
}

/** Only non-secret preferences are persisted in localStorage. */
interface PersistedPrefs {
  provider: AISettings["provider"]
  ollamaUrl: string
}

export function useAISettings() {
  const [settings, setSettings] = useState<AISettings>(DEFAULT_SETTINGS)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    let cancelled = false

    const hydrate = async () => {
      // 1. Silently migrate any legacy plaintext keys into the encrypted
      //    store (and scrub them from the config blob) before reading.
      await migrateLegacyPlaintextKeys()

      // 2. Read non-secret prefs from the legacy localStorage key.
      let prefs: PersistedPrefs = {
        provider: DEFAULT_SETTINGS.provider,
        ollamaUrl: DEFAULT_SETTINGS.ollamaUrl,
      }
      try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<PersistedPrefs>
          prefs = { ...prefs, ...parsed }
        }
      } catch (e) {
        console.error("Failed to parse AI settings", e)
      }

      // 3. Decrypt secrets ("" while locked / unavailable / corrupt).
      const secrets = await loadSecrets()

      if (cancelled || !mountedRef.current) return
      setSettings({
        provider: prefs.provider,
        ollamaUrl: prefs.ollamaUrl,
        anthropicKey: secrets.anthropicKey,
        openaiKey: secrets.openaiKey,
      })
    }

    void hydrate()

    return () => {
      cancelled = true
      mountedRef.current = false
    }
  }, [])

  const saveSettings = useCallback((newSettings: Partial<AISettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings }

      // Persist ONLY non-secret prefs under the legacy key.
      try {
        const prefs: PersistedPrefs = {
          provider: updated.provider,
          ollamaUrl: updated.ollamaUrl,
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      } catch (e) {
        console.error("Failed to persist AI prefs", e)
      }

      // Persist secrets encrypted at rest (async, fire-and-forget; the
      // in-memory state above is the synchronous source of truth).
      void saveSecrets({
        anthropicKey: updated.anthropicKey,
        openaiKey: updated.openaiKey,
      })

      return updated
    })
  }, [])

  const getActiveKey = useCallback(() => {
    if (settings.provider === "anthropic") return settings.anthropicKey
    if (settings.provider === "openai") return settings.openaiKey
    return ""
  }, [settings])

  return {
    settings,
    saveSettings,
    activeKey: getActiveKey(),
    provider: settings.provider,
    ollamaUrl: settings.ollamaUrl,
  }
}
