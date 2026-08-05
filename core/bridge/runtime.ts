import { invoke } from "@tauri-apps/api/core"

/**
 * Detect whether we're running inside the Tauri desktop shell.
 * In a plain browser (or SSR/test env) this is false and every bridge
 * module must fall back gracefully.
 */
export function isTauri(): boolean {
  return (
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  )
}

class BrowserBridgeError extends Error {
  constructor(command: string) {
    super(
      `[opennotes] Tauri command "${command}" called in the browser. ` +
        `This feature requires the desktop app.`,
    )
    this.name = "BrowserBridgeError"
  }
}

/**
 * Safe invoke wrapper. In the browser it rejects with a clear error instead
 * of the cryptic "window.__TAURI_INTERNALS__ is undefined" you'd get from
 * calling invoke() directly.
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!isTauri()) {
    throw new BrowserBridgeError(command)
  }
  return invoke<T>(command, args)
}
