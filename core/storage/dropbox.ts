import { Dropbox } from "dropbox"
import type { StorageProvider, StorageCapabilities, FileEntry } from "./types"

export class DropboxProvider implements StorageProvider {
  readonly id = "dropbox"
  readonly name = "Dropbox"
  readonly capabilities: StorageCapabilities = {
    versionHistory: true,
    binaryFiles: false,
    folders: true,
    batchWrite: false,
  }

  private dbx: Dropbox
  private folderPath: string

  constructor(accessToken: string, folderPath = "/Apps/OpenNotes") {
    this.dbx = new Dropbox({ accessToken })
    this.folderPath = folderPath
  }

  isConnected(): boolean {
    return true
  }

  async connect(): Promise<void> {
    try {
      await this.dbx.filesGetMetadata({ path: this.folderPath })
    } catch {
      await this.dbx.filesCreateFolderV2({
        path: this.folderPath,
        autorename: false,
      })
    }
  }

  async disconnect(): Promise<void> {}

  private _relativePath(fullPath: string): string {
    const prefix = this.folderPath.endsWith("/")
      ? this.folderPath
      : this.folderPath + "/"
    return fullPath.startsWith(prefix)
      ? fullPath.slice(prefix.length)
      : fullPath
  }

  private _fullPath(relativePath: string): string {
    const prefix = this.folderPath.endsWith("/")
      ? this.folderPath
      : this.folderPath + "/"
    return prefix + relativePath
  }

  async listFiles(): Promise<FileEntry[]> {
    const files: FileEntry[] = []
    let hasMore = true
    let cursor: string | undefined

    while (hasMore) {
      const result = cursor
        ? await this.dbx.filesListFolderContinue({ cursor })
        : await this.dbx.filesListFolder({
            path: this.folderPath,
            recursive: true,
          })

      for (const entry of result.result.entries) {
        if (entry[".tag"] === "file" && entry.name.endsWith(".md")) {
          files.push({
            path: this._relativePath(
              entry.path_display ?? entry.path_lower ?? ""
            ),
            content: "",
            etag: entry.rev,
            lastModified: new Date(entry.server_modified),
          })
        }
      }

      hasMore = result.result.has_more
      cursor = result.result.cursor
    }

    return files
  }

  async readFile(path: string): Promise<FileEntry | null> {
    try {
      const result = await this.dbx.filesDownload({
        path: this._fullPath(path),
      })
      const data = result.result as unknown as {
        fileBlob: Blob
        rev?: string
        server_modified?: string
      }
      const content = await this._readBlob(data.fileBlob)

      return {
        path,
        content,
        etag: data.rev,
        lastModified: new Date(data.server_modified ?? Date.now()),
      }
    } catch {
      return null
    }
  }

  private async _readBlob(blob: Blob): Promise<string> {
    if (typeof FileReader !== "undefined") {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsText(blob)
      })
    }
    return blob.text()
  }

  async writeFile(
    path: string,
    content: string,
    etag?: string
  ): Promise<FileEntry> {
    const fullPath = this._fullPath(path)
    const { result } = await this.dbx.filesUpload({
      path: fullPath,
      contents: content,
      mode: { ".tag": "overwrite" },
      autorename: false,
    })

    return {
      path,
      content,
      etag: result.rev,
      lastModified: new Date(result.server_modified),
    }
  }

  async deleteFile(path: string): Promise<void> {
    await this.dbx.filesDeleteV2({ path: this._fullPath(path) })
  }
}
