import { beforeEach, describe, it, expect, vi } from "vitest"

const bridge = vi.hoisted(() => ({
  safeInvoke: vi.fn(),
  tauri: false,
}))

vi.mock("@/core/bridge/runtime", () => ({
  isTauri: () => bridge.tauri,
  safeInvoke: bridge.safeInvoke,
}))

import { buildBugReportURL, openBugReport } from "@/core/feedback/bugReport"

// URLSearchParams form-encodes spaces as "+"; decode both "+"" and "%20".
function bodyOf(url: string): string {
  const raw = url.split("body=")[1] ?? ""
  return decodeURIComponent(raw.replace(/\+/g, " "))
}

describe("buildBugReportURL", () => {
  beforeEach(() => {
    bridge.tauri = false
    bridge.safeInvoke.mockReset()
    vi.restoreAllMocks()
  })

  it("points at the repo's new-issue page with the bug template", () => {
    const url = buildBugReportURL()
    expect(url).toContain("github.com/harshmathurx/OpenNotes/issues/new")
    expect(url).toContain("template=bug_report.md")
  })

  it("pre-fills an environment footer with version and platform", () => {
    const body = bodyOf(buildBugReportURL())
    expect(body).toContain("**Describe the bug**")
    expect(body).toContain("**To reproduce**")
    expect(body).toMatch(/OpenNotes .* · .* · /) // version · app · platform
  })

  it("includes an optional summary in the footer", () => {
    const body = bodyOf(buildBugReportURL({ summary: "sync failed" }))
    expect(body).toContain("sync failed")
  })

  it("opens bug reports through the desktop shell when running in Tauri", async () => {
    bridge.tauri = true
    bridge.safeInvoke.mockResolvedValue(undefined)
    const open = vi.spyOn(window, "open")

    await expect(openBugReport()).resolves.toBe(true)

    expect(bridge.safeInvoke).toHaveBeenCalledWith("open_external_url", {
      url: expect.stringContaining(
        "github.com/harshmathurx/OpenNotes/issues/new",
      ),
    })
    expect(open).not.toHaveBeenCalled()
  })
})
