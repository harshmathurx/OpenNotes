/**
 * sanity.spec.ts — harness self-test. Drives the mock bridge's fs, git and
 * dialog handlers end-to-end through a real page, proving the JSON-RPC
 * channel + Node dispatch work. This is what makes the flows 1 & 3 skips
 * honest: they are blocked ONLY on product wiring, never on mock code.
 */
import { test, expect } from "@playwright/test"
import { installMockBridge } from "./bridgeMock"
import { APP_URL } from "./server"
import { createTempWorkspace, type TempWorkspace } from "./fixtures"

let ws: TempWorkspace
test.beforeEach(async () => {
  ws = await createTempWorkspace()
})
test.afterEach(async () => {
  await ws.cleanup()
})

test("bridge sanity: fs_*/run_git/dialog round-trip through the page", async ({
  page,
}) => {
  await installMockBridge(page, { rootDir: ws.rootDir })
  await page.goto(APP_URL)

  const out = await page.evaluate(async () => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>
        }
      }
    ).__TAURI_INTERNALS__

    const write = (await internals.invoke("fs_write_file", {
      dir: "ignored",
      relPath: "sub/deep-note.md",
      content: "from the bridge",
    })) as { path: string }

    const list = (await internals.invoke("fs_list_markdown", {
      dir: "ignored",
    })) as Array<{ path: string; content: string }>

    const read = (await internals.invoke("fs_read_file", {
      dir: "ignored",
      relPath: "sub/deep-note.md",
    })) as { content: string }

    const git = (await internals.invoke("run_git", {
      args: ["--version"],
      cwd: "/",
    })) as { stdout: string; code: number }

    const picked = await internals.invoke("plugin:dialog|open", {
      options: { directory: true, multiple: false },
    })

    return { write, list, read, git, picked, isTauri: "__TAURI_INTERNALS__" in window }
  })

  expect(out.isTauri).toBe(true)
  expect(out.write.path).toBe("sub/deep-note.md")
  expect(out.list.map((e) => e.path)).toEqual(["sub/deep-note.md"])
  expect(out.read.content).toBe("from the bridge")
  expect(out.git.code).toBe(0)
  expect(out.git.stdout).toContain("git version")
  expect(out.picked).toBe(ws.rootDir)
})
