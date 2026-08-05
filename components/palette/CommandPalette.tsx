"use client"

import { useState, useCallback } from "react"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
} from "@/components/ui/command"

interface ExtensionCommandItem {
  id: string
  extensionId: string
  title: string
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
  files: Array<{ path: string }>
  onSelectFile: (path: string) => void
  onCreateFile: (name: string) => Promise<string>
  onSync: () => void
  remoteEnabled?: boolean
  onOpenStorage?: () => void
  onOpenHome?: () => void
  onOpenExtensions?: () => void
  onOpenFolder?: () => void
  onSwitchFolder?: () => void
  extensionCommands?: ExtensionCommandItem[]
  onRunExtensionCommand?: (id: string) => void
}

export function CommandPalette({
  open,
  onClose,
  files,
  onSelectFile,
  onCreateFile,
  onSync,
  remoteEnabled = false,
  onOpenStorage,
  onOpenHome,
  onOpenExtensions,
  onOpenFolder,
  onSwitchFolder,
  extensionCommands = [],
  onRunExtensionCommand,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("")

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setSearch("")
        onClose()
      }
    },
    [onClose]
  )

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
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
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
              New note{search ? ` "${search}"` : ""}
            </CommandItem>
            {onOpenHome && (
              <CommandItem
                value="Go to workspace home"
                onSelect={() => {
                  onOpenHome()
                  onClose()
                }}
              >
                Go to workspace home
              </CommandItem>
            )}
            <CommandItem value="Sync now" onSelect={handleSync}>
              Sync now
            </CommandItem>
            {onOpenFolder && (
              <CommandItem
                value="Open notes folder"
                onSelect={() => {
                  onOpenFolder()
                  onClose()
                }}
              >
                Open notes folder…
              </CommandItem>
            )}
            {onSwitchFolder && (
              <CommandItem
                value="Switch notes folder"
                onSelect={() => {
                  onSwitchFolder()
                  onClose()
                }}
              >
                Switch notes folder
              </CommandItem>
            )}
            {onOpenExtensions && (
              <CommandItem
                value="Manage extensions"
                onSelect={() => {
                  onOpenExtensions()
                  onClose()
                }}
              >
                Manage extensions
              </CommandItem>
            )}
            {remoteEnabled && onOpenStorage && (
              <CommandItem
                value="Connect storage GitHub remote"
                onSelect={() => {
                  onOpenStorage()
                  onClose()
                }}
              >
                Connect storage...
              </CommandItem>
            )}
          </CommandGroup>

          {extensionCommands.length > 0 && onRunExtensionCommand && (
            <CommandGroup heading="Extensions">
              {extensionCommands.map((cmd) => (
                <CommandItem
                  key={cmd.id}
                  value={`extension ${cmd.title} ${cmd.extensionId}`}
                  onSelect={() => {
                    onRunExtensionCommand(cmd.id)
                    onClose()
                  }}
                >
                  {cmd.title}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
