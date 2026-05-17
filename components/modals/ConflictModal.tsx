"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useState } from "react"

interface ConflictModalProps {
  open: boolean
  path: string
  localContent: string
  remoteContent: string
  onResolve: (content: string) => void
  onClose: () => void
}

export function ConflictModal({
  open,
  path,
  localContent,
  remoteContent,
  onResolve,
  onClose,
}: ConflictModalProps) {
  const [selected, setSelected] = useState<"local" | "remote" | "merge">(
    "merge"
  )

  const mergeContent = `<<<<<<< local (${path})
${localContent}
=======
${remoteContent}
>>>>>>> remote
`

  const displayContent =
    selected === "local"
      ? localContent
      : selected === "remote"
        ? remoteContent
        : mergeContent

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[80vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Conflict: {path}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={selected === "local" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected("local")}
          >
            Keep mine
          </Button>
          <Button
            variant={selected === "remote" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected("remote")}
          >
            Keep theirs
          </Button>
          <Button
            variant={selected === "merge" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelected("merge")}
          >
            Merge manually
          </Button>
        </div>

        <ScrollArea className="h-96 rounded-md border bg-muted/30 p-4 font-mono text-sm">
          <pre className="whitespace-pre-wrap">{displayContent}</pre>
        </ScrollArea>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => {
              const content =
                selected === "local"
                  ? localContent
                  : selected === "remote"
                    ? remoteContent
                    : mergeContent
              onResolve(content)
              onClose()
            }}
            size="sm"
          >
            Resolve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
