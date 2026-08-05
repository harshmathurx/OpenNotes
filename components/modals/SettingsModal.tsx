"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { FolderGit2, Puzzle, Sparkles, Bug } from "lucide-react"
import { openBugReport } from "@/core/feedback/bugReport"

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  /** Name of the notes folder currently in use (basename), or null. */
  notesFolderName: string | null
  isDesktop: boolean
  onOpenGitSync?: () => void
  onChangeFolder?: () => void
  onOpenExtensions?: () => void
  onOpenAI?: () => void
}

export function SettingsModal({
  open,
  onClose,
  notesFolderName,
  isDesktop,
  onOpenGitSync,
  onChangeFolder,
  onOpenExtensions,
  onOpenAI,
}: SettingsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Where your notes live, and the tools you have turned on.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Notes folder</h3>
                <p className="text-xs text-muted-foreground">
                  {notesFolderName
                    ? `Your notes are real files in ${notesFolderName}.`
                    : "Your notes are stored on this device."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {onChangeFolder && isDesktop && (
                <Button variant="outline" size="sm" onClick={onChangeFolder}>
                  Change folder…
                </Button>
              )}
              {onOpenGitSync && isDesktop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenGitSync}
                  className="gap-1.5"
                >
                  <FolderGit2 className="h-3.5 w-3.5" />
                  Open Git Sync
                </Button>
              )}
            </div>
            {!isDesktop && (
              <p className="mt-3 text-xs text-muted-foreground">
                Folders and git sync work best in the OpenNotes Mac app.
              </p>
            )}
          </section>

          {(onOpenExtensions || onOpenAI) && (
            <section className="rounded-lg border p-4">
              <h3 className="mb-3 text-sm font-medium">Workspace</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {onOpenExtensions && (
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 py-3"
                    onClick={onOpenExtensions}
                  >
                    <Puzzle className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm">Extensions</span>
                      <span className="block text-xs opacity-70">
                        Add capabilities
                      </span>
                    </span>
                  </Button>
                )}
                {onOpenAI && (
                  <Button
                    variant="outline"
                    className="h-auto justify-start gap-3 py-3"
                    onClick={onOpenAI}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span className="text-left">
                      <span className="block text-sm">AI Co-Writer</span>
                      <span className="block text-xs opacity-70">
                        Your key or local model
                      </span>
                    </span>
                  </Button>
                )}
              </div>
            </section>
          )}

          <section className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Something not right?</h3>
                <p className="text-xs text-muted-foreground">
                  Report a bug on GitHub. We never collect telemetry — the
                  report only carries what you choose to share, plus your app
                  version and platform.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  openBugReport()
                  onClose()
                }}
                className="shrink-0 gap-1.5"
              >
                <Bug className="h-3.5 w-3.5" />
                Report a bug
              </Button>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
