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

interface RepoPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (owner: string, repo: string, token: string) => void
}

export function RepoPicker({ open, onClose, onSelect }: RepoPickerProps) {
  const [token, setToken] = useState("")
  const [owner, setOwner] = useState("")
  const [repo, setRepo] = useState("opennotes-vault")

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect GitHub</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Personal access token</label>
            <Input
              type="password"
              placeholder="ghp_..."
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Create a classic token with <code>repo</code> scope.{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=OpenNotes"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Create one
              </a>
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              GitHub username or org
            </label>
            <Input
              placeholder="your-username"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Repository name</label>
            <Input
              placeholder="opennotes-vault"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            disabled={!token || !owner || !repo}
            onClick={() => onSelect(owner, repo, token)}
          >
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
