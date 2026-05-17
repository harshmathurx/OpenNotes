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
    const name = search || "Untitled"
    await onCreateFile(name)
    onClose()
  }, [search, onCreateFile, onClose])

  const filteredFiles = search
    ? files.filter((f) => f.path.toLowerCase().includes(search.toLowerCase()))
    : files

  return (
    <CommandDialog open={open} onOpenChange={onClose}>
      <Command>
        <CommandInput
          placeholder="Search files..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No files found.</CommandEmpty>
          <CommandGroup heading="Files">
            {filteredFiles.slice(0, 10).map((f) => (
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
            {search && filteredFiles.length === 0 && (
              <CommandItem onSelect={handleCreate}>
                Create &quot;{search}.md&quot;
              </CommandItem>
            )}
          </CommandGroup>
          <CommandGroup heading="Actions">
            <CommandItem onSelect={handleCreate}>New file</CommandItem>
            <CommandItem
              onSelect={() => {
                onSync()
                onClose()
              }}
            >
              Sync now
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
