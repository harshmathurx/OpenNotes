import { open } from "@tauri-apps/plugin-dialog"
import { isTauri } from "./runtime"

/**
 * Native macOS folder picker. Returns the chosen absolute path, or null if
 * the user cancelled or we're in the browser (no native dialogs there).
 */
export async function pickDirectory(): Promise<string | null> {
  if (!isTauri()) return null
  const selected = await open({ directory: true, multiple: false })
  // `open` returns string | string[] | null; with multiple:false it's string | null.
  return typeof selected === "string" ? selected : null
}
