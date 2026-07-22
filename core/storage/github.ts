import { Octokit } from "@octokit/rest"
import type { StorageProvider, StorageCapabilities, FileEntry } from "./types"

export type GitHubConnectionErrorCode =
  | "bad-token"
  | "repo-not-found-or-not-granted"
  | "missing-write-permission"
  | "rate-limited"
  | "unknown"

export class GitHubConnectionError extends Error {
  constructor(
    readonly code: GitHubConnectionErrorCode,
    message: string
  ) {
    super(message)
    this.name = "GitHubConnectionError"
  }
}

function encodeBase64(content: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(content).toString("base64")
  }
  return btoa(unescape(encodeURIComponent(content)))
}

function decodeBase64(content: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(content, "base64").toString("utf-8")
  }
  return decodeURIComponent(escape(atob(content)))
}

function mapConnectionError(error: unknown): GitHubConnectionError {
  const status = typeof error === "object" && error && "status" in error ? Number(error.status) : undefined

  if (status === 401) {
    return new GitHubConnectionError(
      "bad-token",
      "GitHub token is invalid or expired. Create a new fine-grained token and try again."
    )
  }

  if (status === 403) {
    return new GitHubConnectionError(
      "missing-write-permission",
      "GitHub token does not have Contents read/write permission for this repo."
    )
  }

  if (status === 404) {
    return new GitHubConnectionError(
      "repo-not-found-or-not-granted",
      "Repository not found, or this fine-grained token was not granted access to it."
    )
  }

  if (status === 429) {
    return new GitHubConnectionError(
      "rate-limited",
      "GitHub rate limit reached. Wait a few minutes and try again."
    )
  }

  return new GitHubConnectionError(
    "unknown",
    "OpenNotes could not connect to GitHub. Check the repo name and token permissions."
  )
}

export class GitHubProvider implements StorageProvider {
  readonly id = "github"
  readonly name = "GitHub"
  readonly capabilities: StorageCapabilities = {
    versionHistory: true,
    binaryFiles: false,
    folders: true,
    batchWrite: true,
  }

  private octokit: Octokit
  private owner: string
  private repo: string
  private branch: string
  private connected = false

  constructor(token: string, owner: string, repo: string, branch = "main") {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner.trim()
    this.repo = repo.trim()
    this.branch = branch.trim() || "main"
  }

  isConnected(): boolean {
    return this.connected
  }

  async connect(): Promise<void> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.owner,
        repo: this.repo,
      })
      const permissions = data.permissions as
        | { pull?: boolean; push?: boolean; admin?: boolean; maintain?: boolean }
        | undefined

      if (permissions && !permissions.push && !permissions.admin && !permissions.maintain) {
        throw new GitHubConnectionError(
          "missing-write-permission",
          "GitHub token can read the repo but cannot write contents."
        )
      }

      this.connected = true
    } catch (error) {
      this.connected = false
      if (error instanceof GitHubConnectionError) throw error
      throw mapConnectionError(error)
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  async listFiles(): Promise<FileEntry[]> {
    const files: FileEntry[] = []
    await this._walkTree(".", files)
    return files.filter((f) => f.path.endsWith(".md"))
  }

  private async _walkTree(dir: string, files: FileEntry[]): Promise<void> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: dir,
        ref: this.branch,
      })

      if (Array.isArray(data)) {
        for (const item of data) {
          if (
            item.type === "file" &&
            typeof item.name === "string" &&
            item.name.endsWith(".md")
          ) {
            files.push({
              path: item.path,
              content: "",
              etag: item.sha,
              lastModified: new Date(),
            })
          } else if (item.type === "dir") {
            await this._walkTree(item.path, files)
          }
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }
  }

  async readFile(path: string): Promise<FileEntry | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: this.branch,
      })

      if (Array.isArray(data)) return null
      if (data.type !== "file") return null

      const content = decodeBase64(data.content)
      return {
        path: data.path,
        content,
        etag: data.sha,
        lastModified: new Date(),
      }
    } catch {
      return null
    }
  }

  async writeFile(
    path: string,
    content: string,
    etag?: string
  ): Promise<FileEntry> {
    try {
      const existing = await this.readFile(path)

      const { data } = await this.octokit.rest.repos.createOrUpdateFileContents(
        {
          owner: this.owner,
          repo: this.repo,
          path,
          message: `Update ${path}`,
          content: encodeBase64(content),
          branch: this.branch,
          sha: etag ?? existing?.etag,
        }
      )

      return {
        path,
        content,
        etag: data.content?.sha,
        lastModified: new Date(),
      }
    } catch {
      throw new Error(`Failed to write ${path}`)
    }
  }

  async deleteFile(path: string): Promise<void> {
    const existing = await this.readFile(path)
    if (!existing?.etag) return

    await this.octokit.rest.repos.deleteFile({
      owner: this.owner,
      repo: this.repo,
      path,
      message: `Delete ${path}`,
      sha: existing.etag,
      branch: this.branch,
    })
  }
}
