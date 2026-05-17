import { Octokit } from "@octokit/rest"
import type { StorageProvider, StorageCapabilities, FileEntry } from "./types"

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

  constructor(token: string, owner: string, repo: string, branch = "main") {
    this.octokit = new Octokit({ auth: token })
    this.owner = owner
    this.repo = repo
    this.branch = branch
  }

  isConnected(): boolean {
    return true
  }

  async connect(): Promise<void> {
    try {
      await this.octokit.rest.repos.get({ owner: this.owner, repo: this.repo })
    } catch {
      await this.octokit.rest.repos.createForAuthenticatedUser({
        name: this.repo,
        private: true,
        auto_init: true,
      })
    }
  }

  async disconnect(): Promise<void> {}

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

      const content = Buffer.from(data.content, "base64").toString("utf-8")
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
          content: Buffer.from(content).toString("base64"),
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
