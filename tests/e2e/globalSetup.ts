/**
 * Playwright global setup: guarantee the Next.js dev server is up before
 * any test runs. A server already listening on :3000 is reused; otherwise
 * `pnpm dev` is spawned and awaited (see server.ts).
 *
 * The teardown decision travels to globalTeardown via a small state file
 * in the OS temp dir (Playwright global setup/teardown run in separate
 * processes, so a module-level variable is not enough).
 */

import * as fsp from "node:fs/promises"
import * as os from "node:os"
import * as path from "node:path"
import { ensureDevServer } from "./server"

const STATE_FILE = path.join(os.tmpdir(), "opennotes-e2e-server.json")

export default async function globalSetup(): Promise<void> {
  const handle = await ensureDevServer()
  await fsp.writeFile(
    STATE_FILE,
    JSON.stringify({ reused: handle.reused }),
    "utf8",
  )
}
