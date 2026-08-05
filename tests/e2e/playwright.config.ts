/**
 * Playwright config for the REAL end-to-end suite.
 *
 * This is intentionally SEPARATE from vitest (unit tests live in tests/*,
 * run by vitest). This suite launches real Chromium against the real
 * Next.js dev server on :3000 and injects the mock Tauri bridge
 * (tests/e2e/bridgeMock.ts).
 *
 * The dev server is managed by tests/e2e/server.ts via a global setup:
 * an already-running server on :3000 is reused; otherwise `pnpm dev` is
 * booted and awaited.
 */

import { defineConfig } from "@playwright/test"

export default defineConfig({
  testDir: "./",
  testMatch: ["flows.spec.ts", "sanity.spec.ts"],
  // Boot/reuse the dev server once per run.
  globalSetup: "./globalSetup.ts",
  globalTeardown: "./globalTeardown.ts",
  fullyParallel: false,
  workers: 1, // one dev server; keep runs deterministic
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: "http://localhost:3000",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
})
