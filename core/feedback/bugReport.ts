/**
 * Report-a-bug: opens a pre-filled GitHub issue in the user's browser.
 * Calm and honest — we never collect telemetry, so the report carries only
 * what the user chooses to share plus the app version and platform, which
 * are the two things a maintainer always needs to reproduce a bug.
 */

import { isTauri, safeInvoke } from "@/core/bridge/runtime"

const REPO = "https://github.com/harshmathurx/OpenNotes"
const BUG_TEMPLATE = "bug_report.md"

function appVersion(): string {
  // Set at build time by Next (NEXT_PUBLIC_APP_VERSION), falling back to the
  // package version string baked into the bundle, then "dev".
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION
  }
  return "0.1.1"
}

function platform(): string {
  if (typeof navigator === "undefined") return "unknown"
  const ua = navigator.userAgent
  if (/Mac OS X|macOS/i.test(ua)) return "macOS"
  if (/Windows/i.test(ua)) return "Windows"
  if (/Linux/i.test(ua)) return "Linux"
  return "unknown"
}

function isDesktopApp(): boolean {
  return isTauri()
}

/**
 * Build the GitHub "new issue" URL with the bug template and a small
 * environment footer pre-filled (version + platform + app/web).
 */
export function buildBugReportURL(extra?: { summary?: string }): string {
  const version = appVersion()
  const app = isDesktopApp() ? "Mac app" : "Web"
  const body = [
    "**Describe the bug**",
    "",
    "",
    "**To reproduce**",
    "1. ",
    "",
    "**Expected behavior**",
    "",
    "",
    "---",
    `_OpenNotes ${version} · ${app} · ${platform()}${extra?.summary ? ` · ${extra.summary}` : ""}_`,
  ].join("\n")

  const params = new URLSearchParams({
    template: BUG_TEMPLATE,
    title: "",
    body,
  })
  return `${REPO}/issues/new?${params.toString()}`
}

/** Open the report-a-bug flow in the system browser. */
export async function openBugReport(): Promise<boolean> {
  if (typeof window === "undefined") return false

  const url = buildBugReportURL()

  if (isTauri()) {
    try {
      await safeInvoke("open_external_url", { url })
      return true
    } catch (error) {
      console.warn("[opennotes] Failed to open bug report via Tauri", error)
    }
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer")
  if (opened) return true

  window.location.assign(url)
  return true
}
