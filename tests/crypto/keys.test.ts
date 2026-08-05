import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadSecrets,
  migrateLegacyPlaintextKeys,
  resetKeysContextForTests,
  saveSecrets,
} from "@/core/crypto/keys"

const CONFIG_KEY = "opennotes-ai-config"
const SECRETS_KEY = "opennotes-ai-secrets"

function resetState() {
  localStorage.clear()
  resetKeysContextForTests()
}

describe("core/crypto/keys", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    resetState()
  })

  describe("encrypt/decrypt roundtrip", () => {
    it("encrypts secrets at rest and decrypts them back", async () => {
      const secrets = { anthropicKey: "sk-ant-abc123", openaiKey: "sk-openai-xyz" }

      await saveSecrets(secrets)

      const raw = localStorage.getItem(SECRETS_KEY)
      expect(raw).not.toBeNull()
      const payload = JSON.parse(raw!) as {
        salt: string
        iv: string
        ciphertext: string
      }
      expect(typeof payload.salt).toBe("string")
      expect(typeof payload.iv).toBe("string")
      expect(typeof payload.ciphertext).toBe("string")
      // Plaintext keys must not appear anywhere in the stored payload.
      expect(raw).not.toContain("sk-ant-abc123")
      expect(raw).not.toContain("sk-openai-xyz")

      const loaded = await loadSecrets()
      expect(loaded).toEqual(secrets)
    })

    it("returns empty strings when nothing is stored", async () => {
      const loaded = await loadSecrets()
      expect(loaded).toEqual({ anthropicKey: "", openaiKey: "" })
    })
  })

  describe("migration from legacy plaintext config", () => {
    it("encrypts legacy plaintext keys and scrubs them from the config blob", async () => {
      // Seed the legacy plaintext shape.
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({
          provider: "anthropic",
          anthropicKey: "sk-ant-legacy",
          openaiKey: "sk-openai-legacy",
          ollamaUrl: "http://localhost:11434",
        })
      )

      await migrateLegacyPlaintextKeys()

      // Plaintext is scrubbed from the legacy config; non-secret prefs remain.
      const configRaw = localStorage.getItem(CONFIG_KEY)
      expect(configRaw).not.toBeNull()
      expect(configRaw).not.toContain("sk-ant-legacy")
      expect(configRaw).not.toContain("sk-openai-legacy")
      const config = JSON.parse(configRaw!) as Record<string, unknown>
      expect(config).not.toHaveProperty("anthropicKey")
      expect(config).not.toHaveProperty("openaiKey")
      expect(config.provider).toBe("anthropic")
      expect(config.ollamaUrl).toBe("http://localhost:11434")

      // The encrypted store round-trips to the migrated keys.
      expect(localStorage.getItem(SECRETS_KEY)).not.toBeNull()
      const loaded = await loadSecrets()
      expect(loaded).toEqual({
        anthropicKey: "sk-ant-legacy",
        openaiKey: "sk-openai-legacy",
      })
    })

    it("is a no-op when the config has no plaintext keys (idempotent)", async () => {
      await saveSecrets({ anthropicKey: "sk-ant-current", openaiKey: "" })
      const before = localStorage.getItem(SECRETS_KEY)
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({ provider: "openai", ollamaUrl: "http://localhost:11434" })
      )

      await migrateLegacyPlaintextKeys()

      expect(localStorage.getItem(SECRETS_KEY)).toBe(before)
      const loaded = await loadSecrets()
      expect(loaded).toEqual({ anthropicKey: "sk-ant-current", openaiKey: "" })
    })

    it("does not clobber existing encrypted secrets with blank legacy fields", async () => {
      await saveSecrets({ anthropicKey: "sk-ant-current", openaiKey: "sk-current" })
      localStorage.setItem(
        CONFIG_KEY,
        JSON.stringify({ provider: "anthropic", anthropicKey: "", openaiKey: "" })
      )

      await migrateLegacyPlaintextKeys()

      const loaded = await loadSecrets()
      expect(loaded).toEqual({
        anthropicKey: "sk-ant-current",
        openaiKey: "sk-current",
      })
    })
  })

  describe("corrupt / garbage payloads", () => {
    it("returns empty strings instead of throwing when the payload is garbage", async () => {
      localStorage.setItem(SECRETS_KEY, '{"salt":"!!!","iv":"???","ciphertext":"garbage"}')

      await expect(loadSecrets()).resolves.toEqual({
        anthropicKey: "",
        openaiKey: "",
      })
    })

    it("returns empty strings when the payload is not valid JSON", async () => {
      localStorage.setItem(SECRETS_KEY, "not-json{{{")

      await expect(loadSecrets()).resolves.toEqual({
        anthropicKey: "",
        openaiKey: "",
      })
    })

    it("returns empty strings when required fields are missing", async () => {
      localStorage.setItem(SECRETS_KEY, JSON.stringify({ salt: "abc" }))

      await expect(loadSecrets()).resolves.toEqual({
        anthropicKey: "",
        openaiKey: "",
      })
    })
  })
})
