"use client"

import { useState, useEffect, useCallback } from "react"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command"

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  files: Array<{ path: string }>
  onSelectFile: (path: string) => void
  onCreateFile: (name: string) => Promise<string>
  onSync: () => void
}

export function CommandPalette({
  open,
  onClose,
  files,
  onSelectFile,
  onCreateFile,
  onSync,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const handleCreate = useCallback(async () => {
    const name = search.trim() || "Untitled"
    await onCreateFile(name)
    onClose()
  }, [search, onCreateFile, onClose])

  const handleSync = useCallback(() => {
    onSync()
    onClose()
  }, [onSync, onClose])

  return (
    <CommandDialog open={open} onOpenChange={onClose}>
      <Command>
        <CommandInput
          placeholder="Search files or type a command..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty className="py-4 text-center">
            <p className="text-sm text-muted-foreground">No files match.</p>
            <button
              onClick={() => void handleCreate()}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              Create &quot;{search || "Untitled"}.md&quot;
            </button>
          </CommandEmpty>

          <CommandGroup heading="Files">
            {files.map((f) => (
              <CommandItem
                key={f.path}
                value={f.path}
                onSelect={() => {
                  onSelectFile(f.path)
                  onClose()
                }}
              >
                {f.path}
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandGroup heading="Actions">
            <CommandItem
              value={`Create new file ${search}`}
              onSelect={() => void handleCreate()}
            >
              New file{search ? ` "${search}"` : ""}
            </CommandItem>
            <CommandItem value="Sync now" onSelect={handleSync}>
              Sync now
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
