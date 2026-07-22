import { db } from "@/core/db/schema"
import type { FileEntry } from "@/core/storage/types"

const textEncoder = new TextEncoder()
const DOS_EPOCH = new Date("1980-01-01T00:00:00Z")

export async function exportVaultAsMarkdownZip(): Promise<Blob> {
  const files = await db.files.orderBy("path").toArray()
  return new Blob([buildVaultMarkdownZip(files)], { type: "application/zip" })
}

export async function downloadVaultAsMarkdownZip(
  filename = `opennotes-vault-${new Date().toISOString().slice(0, 10)}.zip`
): Promise<void> {
  const blob = await exportVaultAsMarkdownZip()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function buildVaultMarkdownZip(
  files: Array<Pick<FileEntry, "path" | "content" | "lastModified">>
): Uint8Array {
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const name = textEncoder.encode(sanitizeArchivePath(file.path))
    const content = textEncoder.encode(file.content)
    const crc = crc32(content)
    const { time, date } = toDosDateTime(file.lastModified)

    const localHeader = new Uint8Array(30 + name.length)
    const localView = new DataView(localHeader.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, crc, true)
    localView.setUint32(18, content.length, true)
    localView.setUint32(22, content.length, true)
    localView.setUint16(26, name.length, true)
    localHeader.set(name, 30)

    localParts.push(localHeader, content)

    const centralHeader = new Uint8Array(46 + name.length)
    const centralView = new DataView(centralHeader.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, crc, true)
    centralView.setUint32(20, content.length, true)
    centralView.setUint32(24, content.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    centralHeader.set(name, 46)
    centralParts.push(centralHeader)

    offset += localHeader.length + content.length
  }

  const centralOffset = offset
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, centralOffset, true)

  return concatUint8Arrays([...localParts, ...centralParts, end])
}

function sanitizeArchivePath(path: string): string {
  const normalized = path.replaceAll("\\", "/")
  const safeParts = normalized
    .split("/")
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
  return safeParts.join("/") || "Untitled.md"
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let cursor = 0
  for (const part of parts) {
    result.set(part, cursor)
    cursor += part.length
  }
  return result
}

function toDosDateTime(dateInput: Date): { time: number; date: number } {
  const date = dateInput < DOS_EPOCH ? DOS_EPOCH : dateInput
  const time =
    (date.getUTCHours() << 11) |
    (date.getUTCMinutes() << 5) |
    Math.floor(date.getUTCSeconds() / 2)
  const dosDate =
    ((date.getUTCFullYear() - 1980) << 9) |
    ((date.getUTCMonth() + 1) << 5) |
    date.getUTCDate()
  return { time, date: dosDate }
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}
