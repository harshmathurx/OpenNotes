export interface StorageCapabilities {
  versionHistory: boolean
  binaryFiles: boolean
  folders: boolean
  batchWrite: boolean
}

export interface FileEntry {
  path: string
  content: string
  etag?: string
  lastModified: Date
}

export interface StorageProvider {
  readonly id: string
  readonly name: string
  readonly capabilities: StorageCapabilities

  isConnected(): boolean
  connect(): Promise<void>
  disconnect(): Promise<void>

  listFiles(): Promise<FileEntry[]>
  readFile(path: string): Promise<FileEntry | null>
  writeFile(path: string, content: string, etag?: string): Promise<FileEntry>
  deleteFile(path: string): Promise<void>

  getVersions?(path: string): Promise<{ id: string; date: Date }[]>
  readVersion?(path: string, versionId: string): Promise<string>
}
