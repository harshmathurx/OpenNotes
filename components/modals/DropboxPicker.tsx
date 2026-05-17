"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

interface DropboxPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (token: string, folderPath: string) => void
}

export function DropboxPicker({ open, onClose, onSelect }: DropboxPickerProps) {
  const [token, setToken] = useState("")
  const [folderPath, setFolderPath] = useState("/Apps/OpenNotes")

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect Dropbox</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Access token</label>
            <Input
              type="password"
              placeholder="sl.xxx..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Create an app in the{" "}
              <a
                href="https://www.dropbox.com/developers/apps"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Dropbox App Console
              </a>{" "}
              and generate an access token.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Folder path</label>
            <Input
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!token}
            onClick={() => onSelect(token, folderPath)}
          >
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
