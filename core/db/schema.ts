import Dexie, { type Table } from "dexie"

export interface LocalFile {
  path: string
  content: string
  lastModified: Date
  synced: boolean
  syncPending: boolean
}

export interface SyncRecord {
  id?: number
  path: string
  action: "write" | "delete"
  content?: string
  timestamp: Date
  status: "pending" | "in-progress" | "done" | "failed"
  error?: string
  attempts: number
}

export interface ProviderConfig {
  id: string
  connected: boolean
  config: Record<string, unknown>
}

export interface EncryptedTokens {
  id: string
  iv: Uint8Array
  ciphertext: Uint8Array
  salt: Uint8Array
}

export class OpenNotesDB extends Dexie {
  files!: Table<LocalFile>
  syncQueue!: Table<SyncRecord>
  providerConfig!: Table<ProviderConfig>
  tokens!: Table<EncryptedTokens>

  constructor() {
    super("opennotes-vault")
    this.version(1).stores({
      files: "path",
      syncQueue: "++id, path, status",
      providerConfig: "id",
      tokens: "id",
    })
  }
}

export const db = new OpenNotesDB()
