/**
 * Community Extension Registry — the discovery/index contract.
 *
 * Where `core/extensions/types.ts` is the contract an extension is built
 * AGAINST (manifest + activate), this file is the contract for how the app
 * DISCOVERS third-party extensions: a curated, GitHub-backed index the app
 * can browse and (on the Mac app) install from.
 *
 * The index itself is a plain JSON document (see public/registry/index.json)
 * with a bundled offline copy in core/registry/builtin.ts. Nothing here
 * installs or executes code — this layer is discovery metadata only. The
 * disk-install + sandbox stream builds on top of these shapes.
 */

/** Where the extension's downloadable artifact lives. Community entries only. */
export interface RegistryDownload {
  /**
   * How the artifact is delivered:
   * - "github-release": a tagged release asset on the entry's repo.
   * - "repo-dir": a directory inside the repo (e.g. `extensions/<id>/`).
   */
  type: "github-release" | "repo-dir"
  /** Absolute URL of the artifact or directory. */
  url: string
}

/**
 * One extension listed in the registry.
 *
 * - kind "core": ships bundled with the app; `download` must be absent.
 * - kind "community": installable third-party extension; must carry a
 *   GitHub `repo` and a `download.url`.
 */
export interface RegistryEntry {
  /** Unique, stable, kebab-case id. Matches the extension's manifest id. */
  id: string
  /** Human-readable name. */
  name: string
  /** Semantic version string of the listed release. */
  version: string
  /** One-line description shown in the registry browser. */
  description: string
  /** Author attribution. */
  author: string
  /** GitHub repository URL (e.g. "https://github.com/opennotes-community/daily-quotes"). */
  repo: string
  /** Optional project/docs link. */
  homepage?: string
  /** Optional search/browse tags. */
  tags?: string[]
  /** "core" (bundled with the app) or "community" (installable). */
  kind: "core" | "community"
  /** Installable artifact location. Only meaningful for community entries. */
  download?: RegistryDownload
}

/**
 * The registry index document.
 *
 * `version` is the schema version of the document itself (currently 1) so
 * future format changes can be detected before parsing entries.
 */
export interface RegistryIndex {
  version: 1
  /** ISO-8601 timestamp of the last index update. */
  updatedAt: string
  entries: RegistryEntry[]
}
