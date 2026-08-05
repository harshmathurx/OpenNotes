/**
 * The bundled (offline) registry index.
 *
 * This is the seed catalog that ships with the app: the 5 core extensions
 * plus a few EXAMPLE community entries. It serves two purposes:
 *
 * 1. The offline fallback — when the fetchable index (public/registry/index.json)
 *    can't be reached or fails validation, the app still has a valid catalog.
 * 2. The dev seed — the same data is served over HTTP at /registry/index.json.
 *
 * KEEP IN SYNC with public/registry/index.json. The test suite asserts they
 * match so the two copies can't drift.
 *
 * NOTE: every "community" entry below is a placeholder example. The repos
 * under github.com/opennotes-community are illustrative only — they show the
 * shape of a real listing until the curated community index goes live. Do
 * not treat them as installable extensions.
 */

import type { RegistryIndex } from "./types"

export const BUILTIN_REGISTRY_INDEX: RegistryIndex = {
  version: 1,
  updatedAt: "2026-08-05T00:00:00.000Z",
  entries: [
    // --- Core: bundled with the app, toggled in Settings → Extensions. ---
    {
      id: "git-sync",
      name: "Git Sync",
      version: "0.1.0",
      description: "Sync your notes folder with your local git — VS Code-style, no tokens.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes/tree/main/extensions/gitSync",
      tags: ["sync", "git"],
      kind: "core",
    },
    {
      id: "templates",
      name: "Templates",
      version: "0.1.0",
      description: "Insert rich note templates with date, time, and title variables.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes/tree/main/extensions/templates",
      tags: ["productivity", "writing"],
      kind: "core",
    },
    {
      id: "export",
      name: "Export",
      version: "0.1.0",
      description: "Export notes to Markdown, styled HTML, or a zip bundle.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes/tree/main/extensions/export",
      tags: ["export", "sharing"],
      kind: "core",
    },
    {
      id: "backlinks",
      name: "Backlinks",
      version: "0.1.0",
      description: "See which notes link here, and where this note links.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes/tree/main/extensions/backlinks",
      tags: ["links", "graph"],
      kind: "core",
    },
    {
      id: "ai-cowriter",
      name: "AI Co-Writer",
      version: "0.1.0",
      description: "An optional writing partner on your own API key or local model. Off by default.",
      author: "OpenNotes",
      repo: "https://github.com/opennotes/opennotes/tree/main/extensions/aiCowriter",
      tags: ["ai", "writing"],
      kind: "core",
    },

    // --- Community: EXAMPLE/PLACEHOLDER entries. ---
    // These illustrate the community listing shape. The repos do not exist
    // yet; real curated entries replace them when the index goes live.
    {
      id: "daily-quotes",
      name: "Daily Quotes",
      version: "0.2.1",
      description: "Start each note with a curated quote — writing prompts on autopilot.",
      author: "OpenNotes Community",
      repo: "https://github.com/opennotes-community/daily-quotes",
      homepage: "https://github.com/opennotes-community/daily-quotes#readme",
      tags: ["writing", "inspiration"],
      kind: "community",
      download: {
        type: "repo-dir",
        url: "https://github.com/opennotes-community/daily-quotes/tree/main/extension",
      },
    },
    {
      id: "reading-list",
      name: "Reading List",
      version: "1.0.0",
      description: "Track articles and books to read, with a dockable queue panel.",
      author: "OpenNotes Community",
      repo: "https://github.com/opennotes-community/reading-list",
      tags: ["organization", "panel"],
      kind: "community",
      download: {
        type: "github-release",
        url: "https://github.com/opennotes-community/reading-list/releases/latest/download/reading-list.zip",
      },
    },
    {
      id: "pomodoro",
      name: "Pomodoro",
      version: "0.1.3",
      description: "A calm focus timer in a side panel — 25 minutes on, 5 off.",
      author: "OpenNotes Community",
      repo: "https://github.com/opennotes-community/pomodoro",
      tags: ["focus", "timer", "panel"],
      kind: "community",
      download: {
        type: "repo-dir",
        url: "https://github.com/opennotes-community/pomodoro/tree/main/extension",
      },
    },
  ],
}
