import type { FileEntry, StorageProvider } from "../storage/types"
import type { LocalFile } from "../db/schema"

export interface ConflictInfo {
  path: string
  localContent: string
  remoteContent: string
}

export async function detectConflicts(
  provider: StorageProvider,
  localFiles: LocalFile[]
): Promise<ConflictInfo[]> {
  const conflicts: ConflictInfo[] = []

  for (const local of localFiles) {
    if (!local.synced) continue

    try {
      const remote = await provider.readFile(local.path)
      if (remote && remote.etag && local.content !== remote.content) {
        conflicts.push({
          path: local.path,
          localContent: local.content,
          remoteContent: remote.content,
        })
      }
    } catch {
      // File doesn't exist remotely — not a conflict
    }
  }

  return conflicts
}

export function mergeWithMarkers(
  local: string,
  remote: string,
  path: string
): string {
  return `<<<<<<< local (${path})
${local}
=======
${remote}
>>>>>>> remote
`
}
