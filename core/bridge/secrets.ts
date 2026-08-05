import { isTauri, safeInvoke } from "./runtime"

/**
 * Secrets (AI API keys) live in the macOS Keychain in the desktop app.
 * Every function resolves to null in the browser so the web app keeps
 * using its existing WebCrypto/IndexedDB path untouched.
 */

export async function getSecret(key: string): Promise<string | null> {
  if (!isTauri()) return null
  return safeInvoke<string | null>("get_secret", { key })
}

export async function setSecret(
  key: string,
  value: string,
): Promise<void | null> {
  if (!isTauri()) return null
  return safeInvoke<void>("set_secret", { key, value })
}

export async function deleteSecret(key: string): Promise<void | null> {
  if (!isTauri()) return null
  return safeInvoke<void>("delete_secret", { key })
}
