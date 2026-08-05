/**
 * Device-bound at-rest encryption for AI provider API keys.
 *
 * Threat model / honest guarantees:
 * - Keys are encrypted with AES-GCM-256; the wrapping key is PBKDF2-derived
 *   (100k iters, SHA-256) from a random per-device secret stored in IndexedDB.
 * - Plaintext keys never touch localStorage (which is trivially scraped by
 *   extensions / XSS). The device secret lives in IndexedDB so it is
 *   origin-bound and not readable as a flat string.
 * - This protects against casual exfiltration of localStorage contents and
 *   accidental commits/backups of the config blob. It does NOT defend against
 *   an attacker with full same-origin code execution.
 *
 * If WebCrypto (crypto.subtle) is unavailable (insecure context / very old
 * browsers), secrets fall back to in-memory session storage only and a
 * console warning is emitted. Nothing throws.
 */

import { encryptTokens, decryptTokens } from "./tokens"

const CONFIG_KEY = "opennotes-ai-config"
const SECRETS_KEY = "opennotes-ai-secrets"
const DEVICE_DB_NAME = "opennotes-device"
const DEVICE_STORE = "keys"
const DEVICE_SECRET_ID = "device-secret"

export interface AISecrets {
  anthropicKey: string
  openaiKey: string
}

const EMPTY_SECRETS: AISecrets = { anthropicKey: "", openaiKey: "" }

interface StoredPayload {
  salt: string
  iv: string
  ciphertext: string
}

function isBrowserStorageAvailable(): boolean {
  try {
    return typeof localStorage !== "undefined"
  } catch {
    return false
  }
}

function isCryptoAvailable(): boolean {
  try {
    return (
      typeof crypto !== "undefined" &&
      typeof crypto.subtle !== "undefined" &&
      typeof crypto.subtle.deriveKey === "function"
    )
  } catch {
    return false
  }
}

function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined"
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* base64 helpers (Uint8Array <-> string, storage-safe)                */
/* ------------------------------------------------------------------ */

function toBase64(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/* ------------------------------------------------------------------ */
/* Device secret (IndexedDB)                                           */
/* ------------------------------------------------------------------ */

function openDeviceDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DEVICE_DB_NAME, 1)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DEVICE_STORE)) {
        database.createObjectStore(DEVICE_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open device db"))
  })
}

async function idbGet(database: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(DEVICE_STORE, "readonly")
    const request = tx.objectStore(DEVICE_STORE).get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () =>
      reject(request.error ?? new Error("idb get failed"))
  })
}

async function idbSet(
  database: IDBDatabase,
  key: string,
  value: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(DEVICE_STORE, "readwrite")
    tx.objectStore(DEVICE_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error("idb set failed"))
  })
}

/**
 * Returns the persisted device-bound secret, generating and storing a random
 * one on first use. Returns null when IndexedDB is unavailable.
 */
async function getDeviceSecret(): Promise<string | null> {
  if (!isIndexedDbAvailable()) return null
  let database: IDBDatabase | null = null
  try {
    database = await openDeviceDb()
    const existing = await idbGet(database, DEVICE_SECRET_ID)
    if (typeof existing === "string" && existing.length > 0) {
      return existing
    }
    const generated = toBase64(crypto.getRandomValues(new Uint8Array(32)))
    await idbSet(database, DEVICE_SECRET_ID, generated)
    return generated
  } catch (error) {
    console.warn("[opennotes] device secret unavailable:", error)
    return null
  } finally {
    database?.close()
  }
}

/* ------------------------------------------------------------------ */
/* Encryption context (memory fallback when WebCrypto/IDB unavailable) */
/* ------------------------------------------------------------------ */

interface EncryptionContext {
  /** PBKDF2 passphrase; null => memory-only fallback */
  deviceSecret: string | null
  /** true when real at-rest encryption is active */
  cryptoActive: boolean
}

let contextPromise: Promise<EncryptionContext> | null = null

function getContext(): Promise<EncryptionContext> {
  if (!contextPromise) {
    contextPromise = (async (): Promise<EncryptionContext> => {
      if (!isCryptoAvailable()) {
        console.warn(
          "[opennotes] WebCrypto unavailable; AI keys kept in memory only " +
            "(they will not persist across reloads, and are NOT encrypted)."
        )
        return { deviceSecret: null, cryptoActive: false }
      }
      const deviceSecret = await getDeviceSecret()
      if (!deviceSecret) {
        console.warn(
          "[opennotes] IndexedDB unavailable; AI keys kept in memory only " +
            "(they will not persist across reloads, and are NOT encrypted)."
        )
        return { deviceSecret: null, cryptoActive: false }
      }
      return { deviceSecret, cryptoActive: true }
    })().catch((error) => {
      console.warn("[opennotes] crypto init failed:", error)
      return { deviceSecret: null, cryptoActive: false }
    })
  }
  return contextPromise
}

/** Test-only: reset the cached crypto context. */
export function resetKeysContextForTests(): void {
  contextPromise = null
}

/* ------------------------------------------------------------------ */
/* In-memory session fallback (survives within the page session only)  */
/* ------------------------------------------------------------------ */

let memorySecrets: AISecrets = { ...EMPTY_SECRETS }

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Encrypts and persists AI secrets. Falls back to memory-only storage when
 * WebCrypto/IndexedDB are unavailable. Never throws.
 */
export async function saveSecrets(secrets: AISecrets): Promise<void> {
  try {
    const ctx = await getContext()
    if (!ctx.cryptoActive || !ctx.deviceSecret) {
      memorySecrets = { ...secrets }
      return
    }
    const { salt, iv, ciphertext } = await encryptTokens(
      JSON.stringify(secrets),
      ctx.deviceSecret
    )
    const payload: StoredPayload = {
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(ciphertext),
    }
    if (isBrowserStorageAvailable()) {
      localStorage.setItem(SECRETS_KEY, JSON.stringify(payload))
    }
    memorySecrets = { ...secrets }
  } catch (error) {
    console.warn("[opennotes] failed to persist encrypted secrets:", error)
    memorySecrets = { ...secrets }
  }
}

/**
 * Loads and decrypts AI secrets. Returns empty strings when nothing is
 * stored, the payload is corrupt, or decryption fails. Never throws.
 */
export async function loadSecrets(): Promise<AISecrets> {
  try {
    const ctx = await getContext()
    if (!ctx.cryptoActive || !ctx.deviceSecret) {
      return { ...memorySecrets }
    }
    if (!isBrowserStorageAvailable()) {
      return { ...EMPTY_SECRETS }
    }
    const raw = localStorage.getItem(SECRETS_KEY)
    if (!raw) {
      return { ...EMPTY_SECRETS }
    }
    const payload = JSON.parse(raw) as Partial<StoredPayload>
    if (
      typeof payload.salt !== "string" ||
      typeof payload.iv !== "string" ||
      typeof payload.ciphertext !== "string"
    ) {
      console.warn("[opennotes] malformed secrets payload; ignoring")
      return { ...EMPTY_SECRETS }
    }
    const plaintext = await decryptTokens(
      fromBase64(payload.ciphertext),
      fromBase64(payload.iv),
      fromBase64(payload.salt),
      ctx.deviceSecret
    )
    const parsed = JSON.parse(plaintext) as Partial<AISecrets>
    return {
      anthropicKey:
        typeof parsed.anthropicKey === "string" ? parsed.anthropicKey : "",
      openaiKey: typeof parsed.openaiKey === "string" ? parsed.openaiKey : "",
    }
  } catch (error) {
    console.warn("[opennotes] failed to decrypt secrets:", error)
    return { ...EMPTY_SECRETS }
  }
}

/**
 * One-time, idempotent migration: moves plaintext keys from the legacy
 * "opennotes-ai-config" blob into the encrypted store, then scrubs the
 * plaintext fields from the config. Safe to call on every load. Never throws.
 */
export async function migrateLegacyPlaintextKeys(): Promise<void> {
  try {
    if (!isBrowserStorageAvailable()) return
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return

    let config: Record<string, unknown>
    try {
      config = JSON.parse(raw) as Record<string, unknown>
    } catch {
      return
    }
    if (config === null || typeof config !== "object") return

    const anthropicKey =
      typeof config.anthropicKey === "string" ? config.anthropicKey : ""
    const openaiKey =
      typeof config.openaiKey === "string" ? config.openaiKey : ""

    if (!anthropicKey && !openaiKey) {
      // Already migrated (or never had secrets) — nothing to do.
      return
    }

    // Merge with any already-encrypted secrets (legacy plaintext wins only
    // for keys that are non-empty, so a re-run never clobbers newer data
    // with blank values).
    const existing = await loadSecrets()
    const merged: AISecrets = {
      anthropicKey: anthropicKey || existing.anthropicKey,
      openaiKey: openaiKey || existing.openaiKey,
    }
    await saveSecrets(merged)

    // Scrub plaintext secrets from the config blob.
    const scrubbed = { ...config }
    delete scrubbed.anthropicKey
    delete scrubbed.openaiKey
    localStorage.setItem(CONFIG_KEY, JSON.stringify(scrubbed))
  } catch (error) {
    console.warn("[opennotes] legacy key migration failed:", error)
  }
}
