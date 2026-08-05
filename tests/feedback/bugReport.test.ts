import { describe, it, expect } from "vitest"
import { buildBugReportURL } from "@/core/feedback/bugReport"

// URLSearchParams form-encodes spaces as "+"; decode both "+"" and "%20".
function bodyOf(url: string): string {
  const raw = url.split("body=")[1] ?? ""
  return decodeURIComponent(raw.replace(/\+/g, " "))
}

describe("buildBugReportURL", () => {
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
})
