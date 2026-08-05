/**
 * bridgeMock — an injectable MOCK of the Tauri native bridge
 * (core/bridge/*) backed by a REAL temp folder on disk and REAL git.
 *
 * Why this works (the mechanism):
 *
 *   The app never talks to Tauri's Rust backend directly. It goes through
 *   `@tauri-apps/api`'s `invoke()`, which — in v2 — is exactly:
 *
 *       window.__TAURI_INTERNALS__.invoke(cmd, args, options)
 *
 *   and `core/bridge/runtime.ts` decides "are we in the desktop app?" with:
 *
 *       typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
 *
 *   So if we define `window.__TAURI_INTERNALS__.invoke` BEFORE any app
 *   script runs (via Playwright's `page.addInitScript`, which executes on
 *   every navigation/reload ahead of page scripts), then:
 *
 *     - `isTauri()` returns true  → the git panel, dialog + secrets bridges
 *       light up exactly as they do in the real Mac app;
 *     - every bridge command (`run_git`, `fs_*`, `plugin:dialog|open`,
 *       `get_secret`, …) lands in OUR function instead of Rust.
 *
 *   Our in-page function can't touch the disk, so it forwards each call to
 *   Node over a tiny JSON-RPC-ish channel built from `page.exposeFunction`:
 *
 *     page (addInitScript)                      Node (this file)
 *     ─────────────────────                     ──────────────────
 *     __TAURI_INTERNALS__.invoke(cmd, args)
 *       → window.__opennotesBridgeInvoke({id, cmd, args})
 *                                             → exposed binding resolves here
 *                                               dispatches to handlers:
 *                                                 run_git        → child_process
 *                                                                  `git` in the
 *                                                                  temp repo
 *                                                 fs_*           → node:fs in
 *                                                                  the temp dir
 *                                                 plugin:dialog|open
 *                                                                → returns the
 *                                                                  temp dir
 *                                                 *_secret       → in-memory map
 *       ← Promise resolved with the JSON-safe result
 *
 *   Because `exposeFunction` returns a real Promise to the page, async
 *   git/fs work flows back naturally — the app sees the same async command
 *   contract the Tauri runtime provides.
 *
 * The app code is COMPLETELY UNCHANGED. Everything is injected from the
 * outside, which is exactly the point: we test the real product against a
 * real filesystem + real git.
 */

import { execFile } from "node:child_process"
import * as fsp from "node:fs/promises"
import * as path from "node:path"
import { promisify } from "node:util"
import type { Page } from "@playwright/test"

const execFileAsync = promisify(execFile)

/** Name of the Node-side function exposed into the page. */
const BINDING_NAME = "__opennotesBridgeInvoke"

export interface MockBridgeOptions {
  /** Absolute path of the temp notes folder (and git repo root). */
  rootDir: string
}

interface InvokeEnvelope {
  id: number
  cmd: string
  args: Record<string, unknown> | null
}

interface InvokeReply {
  ok: boolean
  value?: unknown
  error?: string
}

/** Wire shape the app's FileEntryDto expects (core/bridge/fs.ts). */
interface FileEntryDto {
  path: string
  content: string
  modified_ms: number
}

/* ------------------------------------------------------------------ */
/* Node-side command handlers                                          */
/* ------------------------------------------------------------------ */

function assertInside(rootDir: string, relPath: string): string {
  const abs = path.resolve(rootDir, relPath)
  const root = path.resolve(rootDir)
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error(`Path escapes the notes root: ${relPath}`)
  }
  return abs
}

async function listMarkdown(rootDir: string): Promise<FileEntryDto[]> {
  const out: FileEntryDto[] = []
  async function walk(dir: string, rel: string): Promise<void> {
    const entries = await fsp.readdir(dir, { withFileTypes: true })
    for (const e of entries) {
      // Never recurse into (or report) git internals.
      if (e.name === ".git") continue
      const childAbs = path.join(dir, e.name)
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) {
        await walk(childAbs, childRel)
      } else if (e.isFile() && /\.md$/i.test(e.name)) {
        const [content, stat] = await Promise.all([
          fsp.readFile(childAbs, "utf8"),
          fsp.stat(childAbs),
        ])
        out.push({
          path: childRel,
          content,
          modified_ms: Math.round(stat.mtimeMs),
        })
      }
    }
  }
  await walk(rootDir, "")
  out.sort((a, b) => a.path.localeCompare(b.path))
  return out
}

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string; code: number }> {
  try {
    const { stdout, stderr } = await execFileAsync("git", args, {
      cwd,
      maxBuffer: 16 * 1024 * 1024,
    })
    return { stdout, stderr, code: 0 }
  } catch (e) {
    // execFile rejects on non-zero exit; the GitResult contract reports the
    // code instead of throwing (matches the Rust run_git command).
    const err = e as {
      code?: number
      stdout?: string
      stderr?: string
      message?: string
    }
    if (typeof err.code === "number") {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? "",
        code: err.code,
      }
    }
    // Spawn failure (git missing, bad cwd, …): mirror a failing exit code.
    return { stdout: "", stderr: err.message ?? String(e), code: 1 }
  }
}

/** In-memory keychain stand-in for the secrets bridge. */
const secrets = new Map<string, string>()

async function handleCommand(
  rootDir: string,
  cmd: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (cmd) {
    /* ----- gitRunner.ts ----- */
    case "run_git": {
      const gitArgs = (args.args as string[]) ?? []
      const cwd = (args.cwd as string) || rootDir
      return runGit(gitArgs, cwd)
    }

    /* ----- fs.ts (tauriFolder) ----- */
    // The real bridge passes the notes folder as the `dir` argument on every
    // call, and the Rust commands operate on THAT dir (not a fixed root). So
    // when the app switches folders, the same bridge serves the new folder.
    // Honor args.dir, falling back to the boot-time rootDir.
    case "fs_list_markdown": {
      const dir = typeof args.dir === "string" ? args.dir : rootDir
      return listMarkdown(dir)
    }

    case "fs_read_file": {
      const dir = typeof args.dir === "string" ? args.dir : rootDir
      const abs = assertInside(dir, String(args.relPath))
      const [content, stat] = await Promise.all([
        fsp.readFile(abs, "utf8"),
        fsp.stat(abs),
      ])
      return {
        path: String(args.relPath),
        content,
        modified_ms: Math.round(stat.mtimeMs),
      } satisfies FileEntryDto
    }

    case "fs_write_file": {
      const dir = typeof args.dir === "string" ? args.dir : rootDir
      const rel = String(args.relPath)
      const abs = assertInside(dir, rel)
      await fsp.mkdir(path.dirname(abs), { recursive: true })
      await fsp.writeFile(abs, String(args.content), "utf8")
      const stat = await fsp.stat(abs)
      return {
        path: rel,
        content: String(args.content),
        modified_ms: Math.round(stat.mtimeMs),
      } satisfies FileEntryDto
    }

    case "fs_delete_file": {
      const dir = typeof args.dir === "string" ? args.dir : rootDir
      const abs = assertInside(dir, String(args.relPath))
      await fsp.rm(abs, { force: true })
      return null
    }

    /* ----- dialog.ts (tauri-plugin-dialog) ----- */
    case "plugin:dialog|open": {
      // The mock "user" always picks the temp notes folder.
      const options = (args.options ?? {}) as { directory?: boolean }
      if (options.directory) return rootDir
      return rootDir
    }

    /* ----- secrets.ts ----- */
    case "get_secret":
      return secrets.get(String(args.key)) ?? null
    case "set_secret":
      secrets.set(String(args.key), String(args.value))
      return null
    case "delete_secret":
      secrets.delete(String(args.key))
      return null

    default:
      throw new Error(`[bridgeMock] Unhandled Tauri command: ${cmd}`)
  }
}

/* ------------------------------------------------------------------ */
/* Installation                                                        */
/* ------------------------------------------------------------------ */

/**
 * Install the mock bridge on a Playwright page. Call BEFORE `page.goto`.
 *
 * 1. `page.exposeFunction` registers the Node-side dispatcher.
 * 2. `page.addInitScript` defines `window.__TAURI_INTERNALS__` with an
 *    `invoke` that JSON-serializes every call to the dispatcher and awaits
 *    the reply — before any app script executes.
 */
export async function installMockBridge(
  page: Page,
  { rootDir }: MockBridgeOptions,
): Promise<void> {
  await page.exposeFunction(
    BINDING_NAME,
    async (envelope: InvokeEnvelope): Promise<InvokeReply> => {
      try {
        const value = await handleCommand(
          rootDir,
          envelope.cmd,
          envelope.args ?? {},
        )
        return { ok: true, value }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    },
  )

  await page.addInitScript((binding: string) => {
    let nextId = 1

    const w = window as unknown as Record<string, unknown> & {
      __TAURI_INTERNALS__: Record<string, unknown>
    }

    // Keep any fields the @tauri-apps/api may probe; we only need invoke
    // for this app, but a couple of benign extras keep plugin code calm.
    const internals: Record<string, unknown> = w.__TAURI_INTERNALS__ ?? {}

    internals.invoke = (
      cmd: string,
      args?: Record<string, unknown>,
    ): Promise<unknown> => {
      const id = nextId++
      const send = (window as unknown as Record<string, unknown>)[
        binding
      ] as ((envelope: unknown) => Promise<InvokeReplyWire>) | undefined

      interface InvokeReplyWire {
        ok: boolean
        value?: unknown
        error?: string
      }

      if (typeof send !== "function") {
        return Promise.reject(
          new Error(
            `[bridgeMock] Node binding "${binding}" is not installed yet.`,
          ),
        )
      }

      return send({ id, cmd, args: args ?? null }).then((reply) => {
        if (!reply || typeof reply !== "object") {
          throw new Error(`[bridgeMock] Malformed reply for command "${cmd}"`)
        }
        if (!reply.ok) {
          throw new Error(reply.error ?? `[bridgeMock] Command "${cmd}" failed`)
        }
        return reply.value
      })
    }

    // Some plugin code paths register event callbacks; give them an inert
    // id allocator so they never crash on the mock.
    internals.transformCallback = (callback?: unknown) => {
      void callback
      return nextId++
    }
    internals.unregisterCallback = () => undefined
    internals.runCallback = () => undefined
    internals.callbacks = new Map()
    internals.convertFileSrc = (filePath: string) => filePath
    internals.metadata = {
      currentWindow: { label: "main" },
      currentWebview: { windowLabel: "main", label: "main" },
    }
    internals.plugins = { path: { sep: "/", delimiter: ":" } }

    w.__TAURI_INTERNALS__ = internals
  }, BINDING_NAME)
}
