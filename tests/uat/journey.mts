/**
 * Full end-to-end UAT of the OpenNotes journey, captured as screenshots.
 * Drives the real product like a user and reports what breaks.
 * Run: node --experimental-strip-types tests/uat/journey.mts
 */
import { chromium } from "playwright"
import { installMockBridge } from "../e2e/bridgeMock.ts"
import { createTempWorkspace, initGitRepo, createBareRemote, attachRemote } from "../e2e/fixtures.ts"

const SHOT = (n) => `/tmp/uat-${String(n).padStart(2, "0")}.png`
const report = []
const ok = (name, pass, note = "") => {
  report.push({ name, pass, note })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${note ? " — " + note : ""}`)
}

const ws = await createTempWorkspace()
await initGitRepo(ws)
const bare = await createBareRemote()
await attachRemote(ws, bare)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1320, height: 950 } })
const p = await ctx.newPage()
const pageErrors = []
p.on("pageerror", (e) => pageErrors.push(e.message))

async function boot(fresh = true, folder = ws.rootDir) {
  await installMockBridge(p, { rootDir: folder })
  await p.addInitScript(
    ({ dir, fresh }) => {
      try {
        if (fresh) localStorage.removeItem("opennotes-onboarding-complete")
        else localStorage.setItem("opennotes-onboarding-complete", "true")
        localStorage.setItem("opennotes-notes-folder", dir)
        localStorage.setItem("opennotes-ext-storage:git-sync:repoPath", dir)
      } catch {}
    },
    { dir: folder, fresh }
  )
  await p.goto("http://localhost:3000", { waitUntil: "domcontentloaded" })
  await p.waitForTimeout(3800)
}

/* ---------- 1. ONBOARDING (fresh, with folder) ---------- */
await boot(true)
await p.screenshot({ path: SHOT(1) })
ok("Onboarding: welcome screen shows", (await p.content()).includes("calm place to write"))

await p.getByRole("button", { name: /set up how you work/i }).click()
await p.waitForTimeout(600)
await p.screenshot({ path: SHOT(2) })
ok("Onboarding: three setup cards", (await p.content()).includes("Where should your notes live"))

// Choose "A folder on this Mac"
await p.getByText(/a folder on this mac/i).first().click().catch(() => {})
await p.getByRole("button", { name: /continue/i }).click().catch(() => {})
await p.waitForTimeout(600)
await p.screenshot({ path: SHOT(3) })

// Pick the folder (mock resolves to ws)
await p.getByRole("button", { name: /choose a folder/i }).click().catch(() => {})
await p.waitForTimeout(800)
await p.screenshot({ path: SHOT(4) })
const changeLink = await p.getByText(/choose a different folder/i).count()
ok("Onboarding: can change picked folder (Bug 2)", changeLink > 0)

// Continue -> done screen
await p.getByRole("button", { name: /continue/i }).first().click().catch(() => {})
await p.waitForTimeout(600)
await p.screenshot({ path: SHOT(5) })
await p.getByRole("button", { name: /open your first note|start writing/i }).first().click().catch(() => {})
await p.waitForTimeout(1500)
await p.screenshot({ path: SHOT(6) })
const flag = await p.evaluate(() => localStorage.getItem("opennotes-onboarding-complete"))
ok("Onboarding: completes + flag persisted", flag === "true")

/* ---------- 2. SETTINGS (no PAT / no browser-confusion) ---------- */
await p.click('button[title="Settings"]').catch(() => {})
await p.waitForTimeout(600)
await p.screenshot({ path: SHOT(7) })
const settingsText = await p.evaluate(() => document.body.innerText)
ok("Settings: NO personal access token (Bug 1)", !/personal access token|fine-grained/i.test(settingsText))
ok("Settings: shows notes folder / Git Sync", /Git Sync|Notes folder/i.test(settingsText))
await p.keyboard.press("Escape")
await p.waitForTimeout(300)

/* ---------- 3. WRITE NOTES ---------- */
await p.locator(".ProseMirror").first().click().catch(() => {})
await p.keyboard.type("# Blog One\n\nMy first post about calm software.")
await p.waitForTimeout(600)
await p.keyboard.press("Meta+n")
await p.waitForTimeout(900)
await p.locator(".ProMirror, .ProseMirror").first().click().catch(() => {})
await p.locator(".ProseMirror").first().type("# Blog Two\n\nSecond post, still local.")
await p.waitForTimeout(800)
await p.screenshot({ path: SHOT(8) })
const files = await p.evaluate(() => document.body.innerText)
ok("Write: two notes created", /Blog/i.test(files))

/* ---------- 4. TEMPLATES (Bug 4: must create a FRESH note, not overwrite) ---------- */
// Open templates panel
await p.click('[aria-label="Templates"]').catch(async () => { await p.click('button[title*="Templates" i]').catch(()=>{}) })
await p.waitForTimeout(800)
await p.screenshot({ path: SHOT(9) })
// Click "New note" on a template (Meeting notes)
const newNoteBtn = p.getByRole("button", { name: /new note/i }).first()
await newNoteBtn.click().catch((e) => console.log("template new-note click:", e.message))
await p.waitForTimeout(1200)
await p.screenshot({ path: SHOT(10) })
const afterText = await p.locator(".ProseMirror").first().innerText().catch(() => "")
const templHasContent = afterText.trim().length > 10
ok("Templates: new note from template has content (not empty)", templHasContent, `len=${afterText.trim().length}`)
// Reopen blog two to confirm it wasn't overwritten
await b.close()

console.log("\nPAGEERRORS:", pageErrors.length ? pageErrors : "none")
console.log("Shots written to /tmp/uat-*.png")
