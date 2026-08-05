/**
 * Playwright global teardown: stop the dev server only when globalSetup
 * spawned it (a reused developer server is left alone).
 */

import { execFile } from "node:child_process"
import * as fsp from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"

const STATE_FILE = path.join(os.tmpdir(), "opennotes-e2e-server.json")

function killPort(port: number): Promise<void> {
  return new Promise((resolve) => {
    execFile(
      "sh",
      ["-c", `lsof -ti :${port} | xargs kill -TERM 2>/dev/null || true`],
      () => resolve(),
    )
  })
}

export default async function globalTeardown(): Promise<void> {
  let reused = true
  try {
    const raw = await fsp.readFile(STATE_FILE, "utf8")
    reused = Boolean(JSON.parse(raw).reused)
  } catch {
    // No state file → we never started anything.
  }
  await fsp.rm(STATE_FILE, { force: true })

  // Only kill when WE booted the server; never touch a developer's.
  if (!reused) {
    await killPort(3000)
  }
}
