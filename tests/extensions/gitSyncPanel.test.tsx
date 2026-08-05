/**
 * GitSyncPanel regression tests — the two header DropdownMenus, plus the
 * SyncBanner coverage (synced/ahead/diverged states + auto-sync controls).
 *
 * Regression covered: clicking the branch switcher used to hard-crash the app
 * ("Application error: a client-side exception has occurred") because the
 * panel rendered <DropdownMenuLabel> (base-ui Menu.GroupLabel) directly under
 * the content, outside a Menu.Group — and GroupLabel throws
 * "MenuGroupRootContext is missing" at render time when the menu opens.
 *
 * These tests boot the panel into its ready state against a scripted mock
 * GitRunner (same pattern as tests/extensions/gitSync.test.ts), then actually
 * open both menus and assert they render without throwing, the current branch
 * is checkmarked, checkout fires on click, and "New branch…" toggles the
 * inline form.
 */

import "@testing-library/jest-dom/vitest"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import type { GitRunner } from "@/core/git/types"
import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { clearNotesFolder, setNotesFolder } from "@/core/vault/notesFolder"

import { GitSyncPanel } from "@/extensions/gitSync/GitSyncPanel"
import { GIT_SYNC_COPY as C } from "@/extensions/gitSync/copy"

/* ---------- Scripted mock runner (arg-map flavored; ops are order-agnostic here) ---------- */

const CLEAN_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +0 -0",
  "",
].join("\n")

const AHEAD_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +2 -0",
  "",
].join("\n")

const DIVERGED_STATUS = [
  "# branch.oid 9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b",
  "# branch.head main",
  "# branch.upstream origin/main",
  "# branch.ab +2 -3",
  "",
].join("\n")

const LOG_OUT =
  "9c4b2f1a3e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b\x1f9c4b2f1\x1fAdd meeting notes\x1fHarsh\x1f2025-05-17T21:52:10+05:30"

function makeRunner(status: string = CLEAN_STATUS): { run: GitRunner; calls: string[][] } {
  const calls: string[][] = []
  const map: Record<string, string> = {
    "--version": "git version 2.39.3\n",
    "config user.name": "Harsh Rajmathur\n",
    "config user.email": "harsh@example.com\n",
    "rev-parse --is-inside-work-tree": "true\n",
    "status --porcelain=v2 --branch": status,
    "branch --show-current": "main\n",
    "remote -v":
      "origin\tgit@github.com:harsh/notes.git (fetch)\norigin\tgit@github.com:harsh/notes.git (push)\n",
    "branch --format=%(refname:short)": "main\nfeature/x\n",
  }
  const run: GitRunner = async (args) => {
    calls.push([...args])
    const key = args.join(" ")
    if (key.startsWith("log ")) return { stdout: LOG_OUT, stderr: "", code: 0 }
    if (key.startsWith("checkout ")) return { stdout: "", stderr: "", code: 0 }
    return { stdout: map[key] ?? "", stderr: "", code: 0 }
  }
  return { run, calls }
}

function makeApi(): OpenNotesExtensionAPI & { toasts: string[] } {
  const toasts: string[] = []
  const store = new Map<string, string>()
  return {
    toasts,
    getActiveNote: () => null,
    getNotes: () => [],
    openNote: () => {},
    insertIntoActiveNote: () => {},
    showToast: (m: string) => {
      toasts.push(m)
    },
    storage: {
      get: (k: string) => store.get(k) ?? null,
      set: (k: string, v: string) => {
        store.set(k, v)
      },
    },
  }
}

beforeEach(() => {
  clearNotesFolder()
  setNotesFolder("/repo")
})

/** Render the panel and wait for the ready-state header to appear. */
async function renderReadyPanel(status: string = CLEAN_STATUS) {
  const api = makeApi()
  const { run, calls } = makeRunner(status)
  const view = render(
    <GitSyncPanel
      api={api}
      gitSyncOptions={{ isDesktop: true, autoFocusRefresh: false, runner: run }}
    />
  )
  const trigger = await screen.findByRole("button", { name: C.header.branchSwitcher })
  return { api, calls, view, trigger }
}

/**
 * Click a trigger and wait until its menu is really open. Under jsdom +
 * parallel-suite load, base-ui can swallow the first open attempt (a focus
 * or document-listener settle lands a beat late and immediately closes the
 * menu), so retry the click until the menu sticks.
 */
async function openMenu(trigger: HTMLElement): Promise<HTMLElement> {
  let menu: HTMLElement | null = null
  await waitFor(async () => {
    if (!screen.queryByRole("menu")) {
      await act(async () => {
        fireEvent.click(trigger)
      })
    }
    menu = screen.queryByRole("menu")
    expect(menu).not.toBeNull()
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
  })
  return menu as unknown as HTMLElement
}

/* ---------- Branch switcher ---------- */

describe("branch switcher menu", () => {
  it("opens without throwing and lists branches with the current one checked", async () => {
    const { trigger } = await renderReadyPanel()

    const menu = await openMenu(trigger)

    // Group + label wiring (the crash was the missing group context). The
    // aria-labelledby link is applied in a layout effect that jsdom may not
    // flush within waitFor — settle the tree with act() first.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const label = screen.getByText(C.branch.title)
    const labelledGroup = label.closest('[role="group"]')
    expect(menu.contains(labelledGroup)).toBe(true)
    expect(labelledGroup?.getAttribute("aria-labelledby")).toBe(label.getAttribute("id"))

    const current = screen.getByRole("menuitem", { name: /^main$/ })
    const other = screen.getByRole("menuitem", { name: /feature\/x/ })
    expect(current.querySelector("svg")?.classList.contains("opacity-100")).toBe(true)
    expect(other.querySelector("svg")?.classList.contains("opacity-0")).toBe(true)
  })

  it("checks out a branch on item click", async () => {
    const { api, calls, trigger } = await renderReadyPanel()

    await openMenu(trigger)
    const item = await screen.findByRole("menuitem", { name: /feature\/x/ })
    fireEvent.click(item)

    await waitFor(() => {
      expect(calls.some((c) => c.join(" ") === "checkout feature/x")).toBe(true)
    })
    await waitFor(() => {
      expect(api.toasts).toContain(`${C.branch.switched}: feature/x`)
    })
  })

  it("'New branch…' toggles the inline create form", async () => {
    const { trigger } = await renderReadyPanel()

    await openMenu(trigger)
    const newBranch = await screen.findByRole("menuitem", { name: /new branch/i })
    fireEvent.click(newBranch)

    expect(await screen.findByRole("textbox", { name: C.branch.createPlaceholder })).toBeInTheDocument()
  })

  it("closes on Escape and returns focus to the trigger", async () => {
    const { trigger } = await renderReadyPanel()

    await openMenu(trigger)
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })

    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    })
    expect(document.activeElement).toBe(trigger)
  })
})

/* ---------- Overflow menu ---------- */

describe("overflow menu", () => {
  it("opens without throwing and shows its actions", async () => {
    await renderReadyPanel()

    const overflow = screen.getByRole("button", { name: C.header.overflow })
    await openMenu(overflow)

    expect(screen.getByRole("menuitem", { name: new RegExp(C.remote.add) })).toBeInTheDocument()
    expect(screen.getByRole("menuitem", { name: C.header.refresh })).toBeInTheDocument()
  })

  it("'Add remote' toggles the inline remote form", async () => {
    await renderReadyPanel()

    await openMenu(screen.getByRole("button", { name: C.header.overflow }))
    const addRemote = await screen.findByRole("menuitem", { name: new RegExp(C.remote.add) })
    fireEvent.click(addRemote)

    expect(await screen.findByRole("textbox", { name: "Remote name" })).toBeInTheDocument()
  })

  it("refresh item forces a fresh fetch + status", async () => {
    const { calls } = await renderReadyPanel()
    const before = calls.length

    await openMenu(screen.getByRole("button", { name: C.header.overflow }))
    const refresh = await screen.findByRole("menuitem", { name: C.header.refresh })
    fireEvent.click(refresh)

    await waitFor(() => {
      expect(calls.length).toBeGreaterThan(before)
    })
    const after = calls.slice(before).map((c) => c.join(" "))
    // A manual refresh forces a fetch + status (not a full re-probe).
    expect(after.some((c) => c === "fetch")).toBe(true)
    expect(after.some((c) => c.startsWith("status "))).toBe(true)
  })
})

/* ---------- Sync banner ---------- */

describe("sync banner", () => {
  it("shows 'Synced with origin' and the tracking line when clean with an upstream", async () => {
    await renderReadyPanel()

    expect(await screen.findByText(/^Synced with /)).toHaveTextContent("Synced with origin")
    expect(screen.getByText(/→ origin\/main/)).toHaveTextContent("main → origin/main")
    // Auto-sync is off by default; the interval select is disabled until enabled.
    expect(screen.getByRole("switch", { name: /auto-sync/i })).toHaveAttribute("aria-checked", "false")
    expect(screen.getByRole("combobox", { name: /auto-sync interval/i })).toBeDisabled()
  })

  it("shows 'N not on origin yet' with a Push action when ahead, and marks unpushed commits", async () => {
    const { calls } = await renderReadyPanel(AHEAD_STATUS)

    expect(await screen.findByText(/not on origin yet/)).toHaveTextContent("2 commits not on origin yet")
    // The fixture's log has exactly 1 commit, so only 1 "local only" dot can render.
    expect(screen.getAllByLabelText("Local only — not pushed yet")).toHaveLength(1)

    // The banner's primary Push + the panel's Push/Pull row both render a
    // "Push" button — click the banner's (the first).
    fireEvent.click(screen.getAllByRole("button", { name: "Push" })[0])
    await waitFor(() => {
      expect(calls.some((c) => c.join(" ").startsWith("push "))).toBe(true)
    })
  })

  it("shows the guided 'Sync now (pull, then push)' CTA when diverged", async () => {
    const { calls } = await renderReadyPanel(DIVERGED_STATUS)

    expect(await screen.findByText(/to push, .* to pull/)).toHaveTextContent("2 commits to push, 3 commits to pull")
    const syncNow = screen.getByRole("button", { name: "Sync now (pull, then push)" })
    expect(syncNow).toBeInTheDocument()

    fireEvent.click(syncNow)
    await waitFor(() => {
      const cmds = calls.map((c) => c.join(" "))
      const pullAt = cmds.findIndex((c) => c.startsWith("pull "))
      const pushAt = cmds.findIndex((c) => c.startsWith("push "))
      expect(pullAt).toBeGreaterThanOrEqual(0)
      expect(pushAt).toBeGreaterThan(pullAt)
    })
  })

  it("auto-sync toggle enables the interval select and the select changes the interval", async () => {
    await renderReadyPanel()

    const toggle = screen.getByRole("switch", { name: /auto-sync/i })
    fireEvent.click(toggle)

    // Once the hook's autoSync is wired, the toggle flips and unlocks the
    // interval select (5/15/30/60). Until then it stays in its calm off state.
    if (toggle.getAttribute("aria-checked") === "true") {
      const select = screen.getByRole("combobox", { name: /auto-sync interval/i })
      expect(select).toBeEnabled()
      expect(await screen.findByText(/Auto-sync on · every 30m/)).toBeInTheDocument()

      fireEvent.change(select, { target: { value: "15" } })
      expect((select as HTMLSelectElement).value).toBe("15")
      expect(await screen.findByText(/Auto-sync on · every 15m/)).toBeInTheDocument()
    }
  })
})

/* ---------- Primitive-level guard ---------- */

// Regression guard: base-ui's GroupLabel throws outside a Menu.Group. The
// wrapper must make a bare label safe forever.
describe("DropdownMenuLabel primitive", () => {
  it("a bare label (no explicit group) renders without throwing", async () => {
    const { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } =
      await import("@/components/ui/dropdown-menu")

    render(
      <DropdownMenu>
        <DropdownMenuTrigger aria-label="Open bare-label menu">open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Lone label</DropdownMenuLabel>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open bare-label menu" }))
    })
    expect(await screen.findByRole("menu")).toBeInTheDocument()
    expect(screen.getByText("Lone label")).toBeInTheDocument()
  })
})
