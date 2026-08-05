/**
 * flows.spec.ts — the five core product flows, as REAL Playwright tests.
 *
 * Each test:
 *   - launches Chromium against the real Next.js dev server on :3000,
 *   - gets a FRESH temp folder on disk (fixtures.ts),
 *   - injects the mock Tauri bridge backed by that folder + real git
 *     (bridgeMock.ts) BEFORE any app script runs,
 *   - asserts BOTH what the user sees (UI) and what is true on disk / in
 *     the real git repo (Node fs + child_process git).
 *
 * Flow status honesty (per the harness brief):
 *   - Flows 2, 4, 5 run green NOW against the shipped product.
 *   - Flows 1 and 3 are written to the EXPECTED desktop behavior, but the
 *     wiring streams they depend on — the vault write path going through
 *     FolderVaultStore (disk mirror) and reconcile-on-launch from
 *     FolderVaultStore — have NOT landed in useVault/AppShell yet. Until
 *     then the on-disk assertions cannot pass, so those two are
 *     test.skip() with a precise explanation. The mock bridge's fs_*
 *     commands are fully implemented and the tests will light up the
 *     moment the product wires disk persistence.
 */

import { test, expect, type Page } from "@playwright/test"

import { installMockBridge } from "./bridgeMock"
import { APP_URL } from "./server"
import {
  advanceRemote,
  attachRemote,
  createBareRemote,
  createTempWorkspace,
  initGitRepo,
  gitCommitAll,
  gitCommitCount,
  gitCurrentBranch,
  gitLogSubjects,
  gitRemoteCommitCount,
  gitRemoteLogSubjects,
  gitShowFile,
  gitShowLatestFiles,
  readNoteFromDisk,
  seedNote,
  type TempWorkspace,
} from "./fixtures"

/** The localStorage keys the app reads for the notes folder / git repo. */
const NOTES_FOLDER_KEY = "opennotes-notes-folder"
const GIT_SYNC_REPO_KEY = "opennotes-ext-storage:git-sync:repoPath"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/**
 * Fresh workspace + mock bridge + persisted "picked folder" state, so the
 * app boots believing the user already chose this temp folder (exactly
 * like a returning desktop user).
 */
async function bootApp(
  page: Page,
  ws: TempWorkspace,
): Promise<void> {
  await installMockBridge(page, { rootDir: ws.rootDir })
  // Persist the notes folder + git-sync repo path BEFORE app scripts run.
  // Also mark onboarding complete: the e2e user is a returning desktop user,
  // so the first-run OnboardingFlow must not intercept these flows.
  await page.addInitScript(
    ({ notesKey, gitKey, dir }) => {
      try {
        window.localStorage.setItem(notesKey, dir)
        window.localStorage.setItem(gitKey, dir)
        window.localStorage.setItem("opennotes-onboarding-complete", "true")
      } catch {
        // localStorage unavailable — app will fall back to the picker,
        // which our mock resolves to the same folder anyway.
      }
    },
    { notesKey: NOTES_FOLDER_KEY, gitKey: GIT_SYNC_REPO_KEY, dir: ws.rootDir },
  )
  await page.goto(APP_URL)
}

/** Open the Git Sync panel from the activity rail (button title = "Git Sync"). */
async function openGitSyncPanel(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Git Sync", exact: true }).first().click()
  // The panel header renders an uppercase "GIT SYNC" label.
  await expect(
    page.getByText(/^git sync$/i).first(),
  ).toBeVisible()
}

/** Wait for the git panel to reach its ready state (repo detected). */
async function waitForGitReady(page: Page): Promise<void> {
  // Ready state shows the branch switcher ("Switch branch" trigger).
  await expect(
    page.getByRole("button", { name: "Switch branch" }),
  ).toBeVisible({ timeout: 15_000 })
}

/** The "Sync status" banner region (aria-label="Sync status"). */
function syncBanner(page: Page) {
  return page.getByRole("region", { name: "Sync status" })
}

/* ------------------------------------------------------------------ */
/* The 5 flows                                                         */
/* ------------------------------------------------------------------ */

test.describe("OpenNotes e2e (mock Tauri bridge, real disk + git)", () => {
  let ws: TempWorkspace

  test.beforeEach(async () => {
    ws = await createTempWorkspace()
  })

  test.afterEach(async () => {
    await ws.cleanup()
  })

  /* ---------------------------------------------------------------- */
  /* 1. Write a note → appears in the list AND lands on disk.          */
  /* ---------------------------------------------------------------- */
  test("flow 1: writing a note creates a real .md file on disk", async ({
    page,
  }) => {
    await bootApp(page, ws)

    // Empty state → create the first note.
    await page
      .getByRole("button", { name: /create first note/i })
      .click()

    // Type into the editor.
    const editor = page.locator(".ProseMirror").first()
    await editor.click()
    await editor.pressSequentially("Hello on disk")

    // The note appears in the sidebar list.
    await expect(page.getByText("Untitled.md").first()).toBeVisible()

    // REAL assertion: the temp folder now holds a matching .md file.
    await expect
      .poll(async () => (await readNoteFromDisk(ws, "Untitled.md")) ?? "")
      .toContain("Hello on disk")
  })

  /* ---------------------------------------------------------------- */
  /* 2. Two notes + switching — regression for content bleed.          */
  /* ---------------------------------------------------------------- */
  test("flow 2: switching notes never bleeds content", async ({ page }) => {
    await bootApp(page, ws)

    // Create note A and type AAA.
    await page.getByRole("button", { name: /create first note/i }).click()
    const editor = page.locator(".ProseMirror").first()
    await editor.click()
    await editor.pressSequentially("AAA")

    // Create note B (sidebar "+" button) and type BBB.
    await page
      .getByRole("button", { name: /new file/i })
      .first()
      .click()
    const editorB = page.locator(".ProseMirror").first()
    await editorB.click()
    await editorB.pressSequentially("BBB")

    // There should now be two notes in the sidebar.
    await expect(page.getByText("Untitled.md").first()).toBeVisible()
    await expect(page.getByText("Untitled 1.md").first()).toBeVisible()

    // Click note A → the editor shows ONLY AAA (no BBB bleed).
    await page.getByText("Untitled.md").first().click()
    await expect(page.locator(".ProseMirror").first()).toContainText("AAA")
    await expect(page.locator(".ProseMirror").first()).not.toContainText("BBB")

    // Click note B → only BBB.
    await page.getByText("Untitled 1.md").first().click()
    await expect(page.locator(".ProseMirror").first()).toContainText("BBB")
    await expect(page.locator(".ProseMirror").first()).not.toContainText("AAA")

    // Switch back to A → AAA again.
    await page.getByText("Untitled.md").first().click()
    await expect(page.locator(".ProseMirror").first()).toContainText("AAA")
    await expect(page.locator(".ProseMirror").first()).not.toContainText("BBB")
  })

  /* ---------------------------------------------------------------- */
  /* 3. Reconcile-on-launch: a file written OUTSIDE the app appears.   */
  /* ---------------------------------------------------------------- */
  test("flow 3: reconcile-on-launch picks up externally-created files", async ({
    page,
  }) => {
    // Node writes the file OUTSIDE the app before the app boots.
    await seedNote(ws, "external.md", "written outside the app")

    await bootApp(page, ws)

    // It shows up in the file list.
    await expect(page.getByText("external.md").first()).toBeVisible()

    // And opening it shows the seeded content.
    await page.getByText("external.md").first().click()
    await expect(page.locator(".ProseMirror").first()).toContainText(
      "written outside the app",
    )
  })

  /* ---------------------------------------------------------------- */
  /* 4. Git sync commit — regression for "commit finds nothing".        */
  /* ---------------------------------------------------------------- */
  test("flow 4: committing from the Git Sync panel creates a real commit", async ({
    page,
  }) => {
    // Real repo, seeded with an existing committed note so the panel opens
    // in its ready state and the new note shows up as an untracked change.
    await initGitRepo(ws)
    await seedNote(ws, "existing.md", "already here")
    await gitCommitAll(ws, "seed commit")

    const commitsBefore = await gitCommitCount(ws)
    expect(commitsBefore).toBe(1)

    await bootApp(page, ws)
    await openGitSyncPanel(page)
    await waitForGitReady(page)

    // Write a note in the app (goes to IndexedDB today; but the notes
    // folder is the git root, so we create the file the panel commits by
    // seeding it — the honest e2e of the PANEL is: it commits what is in
    // the folder).
    //
    // To exercise the commit end-to-end we write via the app's own create
    // path when disk mirroring lands; for now the folder write below
    // stands in for "a note the user saved".
    await seedNote(ws, "new-note.md", "fresh note content")

    // Refresh the panel so git sees the new untracked file.
    await page.getByRole("button", { name: "Refresh status" }).click()
    await expect(
      page.getByRole("button", { name: "new-note.md" }).first(),
    ).toBeVisible()

    // Type a commit message and commit.
    await page.getByPlaceholder("Commit message").fill("add new note")
    await page.getByRole("button", { name: "Commit", exact: true }).click()

    // REAL assertion: a new commit exists in the temp repo containing the note.
    await expect.poll(async () => gitCommitCount(ws)).toBe(commitsBefore + 1)

    const subjects = await gitLogSubjects(ws)
    expect(subjects[0]).toBe("add new note")

    const committed = await gitShowLatestFiles(ws)
    expect(committed).toContain("new-note.md")

    const content = await gitShowFile(ws, "new-note.md")
    expect(content).toBe("fresh note content")
  })

  /* ---------------------------------------------------------------- */
  /* 5. Branch menu — regression for the branch-picker crash.           */
  /* ---------------------------------------------------------------- */
  test("flow 5: branch switcher opens and lists the current branch", async ({
    page,
  }) => {
    await initGitRepo(ws)
    await seedNote(ws, "readme.md", "# notes")
    await gitCommitAll(ws, "init")

    // Capture any uncaught page errors — the branch-picker crash signature.
    const pageErrors: Error[] = []
    page.on("pageerror", (err) => pageErrors.push(err))

    await bootApp(page, ws)
    await openGitSyncPanel(page)
    await waitForGitReady(page)

    const branch = await gitCurrentBranch(ws)
    expect(branch).toBe("main")

    // Open the branch switcher.
    await page.getByRole("button", { name: "Switch branch" }).click()

    // The menu lists the current branch (menu item role), with no crash.
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    await expect(
      menu.getByRole("menuitem", { name: "main" }),
    ).toBeVisible()

    // No page error fired anywhere along the way.
    expect(pageErrors).toEqual([])
  })

  /* ---------------------------------------------------------------- */
  /* 6. Switching notes folders — pick/change/switch between folders.  */
  /* ---------------------------------------------------------------- */
  test("flow 6: switching notes folders swaps the workspace contents", async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on("pageerror", (err) => pageErrors.push(err))

    // Folder A is the shared workspace; folder B is a second real folder.
    const wsB = await createTempWorkspace()
    try {
      await seedNote(ws, "alpha.md", "alpha note")
      await seedNote(wsB, "beta.md", "beta note")

      // Boot into folder A (the shared ws) — bootApp persists the folder +
      // repo path and the mock bridge, then loads the app.
      await bootApp(page, ws)
      // Pre-seed the recent-folders list so folder B appears in the switcher.
      await page.evaluate(
        ([a, b]) =>
          window.localStorage.setItem(
            "opennotes-recent-folders",
            JSON.stringify([a, b]),
          ),
        [ws.rootDir, wsB.rootDir],
      )
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForTimeout(2500)

      // Folder A's note is shown; folder B's is not.
      await expect(page.getByText("alpha.md").first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText("beta.md")).toHaveCount(0)

      // Open the folder switcher and switch to folder B (the recent entry).
      await page
        .getByRole("button", { name: /notes folder/i })
        .first()
        .click()
      await page
        .getByRole("menuitem", {
          name: new RegExp(
            wsB.rootDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        })
        .first()
        .click()

      // Folder B's note now appears, and folder A's is gone.
      await expect(page.getByText("beta.md").first()).toBeVisible({
        timeout: 10000,
      })
      await expect(page.getByText("alpha.md")).toHaveCount(0)

      // No crash along the way.
      expect(pageErrors).toEqual([])
    } finally {
      await wsB.cleanup()
    }
  })

  /* ---------------------------------------------------------------- */
  /* 7. Sync banner — local-vs-remote truth against a BARE remote.     */
  /* ---------------------------------------------------------------- */
  test("flow 7: the sync banner reflects local-vs-remote state end to end", async ({
    page,
  }) => {
    const pageErrors: Error[] = []
    page.on("pageerror", (err) => pageErrors.push(err))

    // Fresh repo + a bare remote attached (NOT pushed yet).
    await initGitRepo(ws)
    const bare = await createBareRemote()
    await attachRemote(ws, bare)
    try {
      // Seed a note BEFORE boot: AppShell returns the first-run welcome screen
      // (and never mounts the activity rail / Git Sync button) while
      // `files.length === 0`, so the folder must hold at least one .md for the
      // panel to be reachable — same reason flows 4/5 seed before bootApp.
      await seedNote(ws, "synced-note.md", "banner end-to-end content")

      await bootApp(page, ws)
      await openGitSyncPanel(page)
      await waitForGitReady(page)

      // The seeded note is the change the panel will commit.
      await page.getByRole("button", { name: "Refresh status" }).click()
      await expect(
        page.getByRole("button", { name: "synced-note.md" }).first(),
      ).toBeVisible()

      // Commit it from the panel.
      await page.getByPlaceholder("Commit message").fill("add synced note")
      await page.getByRole("button", { name: "Commit", exact: true }).click()

      // Node truth: the commit exists locally but is NOT on the bare remote.
      await expect.poll(async () => gitCommitCount(ws), { timeout: 15_000 }).toBe(1)
      expect(await gitRemoteCommitCount(bare)).toBe(0)

      // Banner: the branch has a remote but has never been pushed, so it has
      // NO UPSTREAM yet — the honest state is "main isn't tracking a remote
      // branch" with a "Push to origin" primary action (copy.ts noUpstream).
      const banner = syncBanner(page)
      await expect(banner).toContainText(/isn't tracking a remote branch/i, {
        timeout: 15_000,
      })

      // Push from the banner's own primary action ("Push to origin" sets the
      // upstream via `push -u origin main`).
      await banner
        .getByRole("button", { name: /Push to origin/i })
        .click()

      // Node truth: the commit is now on the bare remote.
      await expect.poll(async () => gitRemoteCommitCount(bare), {
        timeout: 15_000,
      }).toBe(1)
      expect((await gitRemoteLogSubjects(bare))[0]).toBe("add synced note")

      // Banner flips to synced.
      await expect(banner).toContainText(/Synced with origin/i, {
        timeout: 15_000,
      })

      // AHEAD: with the upstream now established, commit a second note locally
      // (without pushing) → the banner reports it as "not on origin yet".
      await seedNote(ws, "ahead-note.md", "ahead content")
      await page.getByRole("button", { name: "Refresh status" }).click()
      await page.getByPlaceholder("Commit message").fill("ahead commit")
      await page.getByRole("button", { name: "Commit", exact: true }).click()
      await expect.poll(async () => gitCommitCount(ws), { timeout: 15_000 }).toBe(2)
      await expect(banner).toContainText(/not on origin yet/i, {
        timeout: 15_000,
      })
      // Push it so we're back to a clean synced base for the behind step.
      await banner.getByRole("button", { name: "Push", exact: true }).click()
      await expect.poll(async () => gitRemoteCommitCount(bare), {
        timeout: 15_000,
      }).toBe(2)
      await expect(banner).toContainText(/Synced with origin/i, {
        timeout: 15_000,
      })

      // BEHIND: advance the remote out from under the workspace → ws is behind.
      await advanceRemote(ws, bare, {
        fileName: "remote.md",
        content: "came from elsewhere",
        message: "remote commit",
      })
      await page.getByRole("button", { name: "Refresh status" }).click()
      await expect(banner).toContainText(/new .* on origin/i, {
        timeout: 15_000,
      })

      // DIVERGED: make ws ALSO commit locally while the remote advanced.
      await seedNote(ws, "local.md", "local divergence")
      await page.getByRole("button", { name: "Refresh status" }).click()
      await page.getByPlaceholder("Commit message").fill("local divergent commit")
      await page.getByRole("button", { name: "Commit", exact: true }).click()
      await expect.poll(async () => gitCommitCount(ws), { timeout: 15_000 }).toBe(3)

      await page.getByRole("button", { name: "Refresh status" }).click()
      await expect(banner).toContainText(/to push, .* to pull/i, {
        timeout: 15_000,
      })
      await expect(
        banner.getByRole("button", { name: /Sync now \(pull, then push\)/i }),
      ).toBeVisible()

      // No uncaught page error across the whole flow.
      expect(pageErrors).toEqual([])
    } finally {
      await bare.cleanup()
    }
  })
})
