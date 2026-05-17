"use client"

import { useState, useEffect } from "react"
import { useVault } from "@/hooks/useVault"

export default function Home() {
  const { files, activeFile, setActiveFile, createFile, saveFile, deleteFile } =
    useVault()
  const [content, setContent] = useState("")

  useEffect(() => {
    if (activeFile) {
      const file = files.find((f) => f.path === activeFile)
      if (file) setContent(file.content)
    } else {
      setContent("")
    }
  }, [activeFile, files])

  const handleCreate = async () => {
    const name = prompt("File name:")
    if (name) await createFile(name)
  }

  const handleDelete = async (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      await deleteFile(path)
    }
  }

  if (files.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <p className="text-muted-foreground">No files yet</p>
          <button
            onClick={handleCreate}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Create one
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <div className="flex w-64 flex-col border-r">
        <div className="flex items-center justify-between border-b p-3">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Files
          </span>
          <button
            onClick={handleCreate}
            className="rounded-md p-1 hover:bg-accent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-0.5 overflow-auto p-2">
          {files.map((f) => (
            <div
              key={f.path}
              className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm"
            >
              <div
                onClick={() => setActiveFile(f.path)}
                className={`flex-1 truncate ${
                  activeFile === f.path
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-2 inline"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                {f.path}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(f.path)
                }}
                className="rounded p-0.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 items-center border-b px-3">
          <span className="text-sm text-muted-foreground">
            {activeFile || "Untitled"}
          </span>
        </div>

        <div className="flex flex-1 justify-center p-8">
          <textarea
            className="h-full w-full max-w-[720px] resize-none bg-transparent font-mono text-base leading-relaxed outline-none"
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              if (activeFile) saveFile(activeFile, e.target.value)
            }}
          />
        </div>
      </div>
    </div>
  )
}
