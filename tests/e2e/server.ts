/**
 * server.ts — make sure a Next.js dev server is reachable on :3000.
 *
 * Strategy: reuse, don't compete.
 *   - If something already answers on APP_URL, we use it (fast path — the
 *     common case when a dev has `pnpm dev` running).
 *   - Otherwise we spawn `pnpm dev` ourselves as a detached child and wait
 *     until it serves 200s.
 *
 * `ensureDevServer()` returns a `stop()` handle; it is a no-op when we
 * reused an external server so we never kill the developer's process.
 */

import { spawn, type ChildProcess } from "node:child_process"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, "..", "..")

export const APP_PORT = 3000
export const APP_URL = `http://localhost:${APP_PORT}`

const READY_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 500

async function isUp(): Promise<boolean> {
  try {
    const res = await fetch(APP_URL, {
      // HEAD isn't implemented by every Next route handler; a plain GET of
      // "/" is the honest liveness check.
      method: "GET",
      signal: AbortSignal.timeout(3_000),
    })
    // Any non-5xx response means the server is alive and compiling.
    return res.status < 500
  } catch {
    return false
  }
}

export interface DevServerHandle {
  /** Base URL of the app under test. */
  url: string
  /** True when we reused an already-running server (stop() is then a no-op). */
  reused: boolean
  /** Stop the server if WE started it. Safe to call always. */
  stop(): Promise<void>
}

export async function ensureDevServer(): Promise<DevServerHandle> {
  if (await isUp()) {
    return { url: APP_URL, reused: true, stop: async () => {} }
  }

  const child: ChildProcess = spawn("pnpm", ["dev"], {
    cwd: PROJECT_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, PORT: String(APP_PORT) },
  })

  // Keep boot output for debugging on failure.
  let bootLog = ""
  child.stdout?.on("data", (d) => {
    bootLog += String(d)
  })
  child.stderr?.on("data", (d) => {
    bootLog += String(d)
  })

  const deadline = Date.now() + READY_TIMEOUT_MS
  let exited = false
  child.on("exit", () => {
    exited = true
  })

  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(
        `[e2e server] pnpm dev exited before becoming ready.\n--- boot log ---\n${bootLog}`,
      )
    }
    if (await isUp()) {
      return {
        url: APP_URL,
        reused: false,
        stop: () =>
          new Promise<void>((resolve) => {
            child.once("exit", () => resolve())
            child.kill("SIGTERM")
            // Don't hang teardown forever.
            setTimeout(() => {
              child.kill("SIGKILL")
              resolve()
            }, 5_000).unref()
          }),
      }
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
  }

  child.kill("SIGKILL")
  throw new Error(
    `[e2e server] Dev server did not become ready within ${READY_TIMEOUT_MS}ms.\n--- boot log ---\n${bootLog}`,
  )
}
