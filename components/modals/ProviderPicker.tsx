"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { HardDrive, GitBranch, Cloud } from "lucide-react"

interface ProviderPickerProps {
  open: boolean
  onClose: () => void
  onSelectLocal: () => void
  onSelectGitHub: () => void
  onSelectDropbox: () => void
}

export function ProviderPicker({
  open,
  onClose,
  onSelectLocal,
  onSelectGitHub,
  onSelectDropbox,
}: ProviderPickerProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose storage</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Where should your files live? You can change this anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="flex h-auto items-center justify-start gap-3 py-4"
            onClick={onSelectLocal}
          >
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Just this browser</div>
              <div className="text-xs text-muted-foreground">
                No account needed. Files saved in your browser.
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex h-auto items-center justify-start gap-3 py-4"
            onClick={onSelectGitHub}
          >
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">GitHub</div>
              <div className="text-xs text-muted-foreground">
                One repo = one vault. Free version history.
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="flex h-auto items-center justify-start gap-3 py-4"
            onClick={onSelectDropbox}
          >
            <Cloud className="h-5 w-5 text-muted-foreground" />
            <div className="text-left">
              <div className="font-medium">Dropbox</div>
              <div className="text-xs text-muted-foreground">
                Syncs everywhere Dropbox does.
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
