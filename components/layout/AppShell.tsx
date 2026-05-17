"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { Editor } from "../editor/Editor"
import { useVault } from "@/hooks/useVault"

export function AppShell() {
  const { files, activeFile, setActiveFile, createFile, saveFile, deleteFile } =
    useVault()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [zenMode, setZenMode] = useState(false)

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? ""

  return (
    <div className="flex h-screen bg-background">
      {!zenMode && sidebarOpen && (
        <Sidebar
          files={files}
          activeFile={activeFile}
          onSelect={setActiveFile}
          onCreate={createFile}
          onDelete={deleteFile}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {!zenMode && (
          <TitleBar
            path={activeFile}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleZen={() => setZenMode(!zenMode)}
          />
        )}

        <div className="flex-1 overflow-hidden">
          <Editor
            content={activeContent}
            onChange={(content) => {
              if (activeFile) saveFile(activeFile, content)
            }}
            onSave={() => {
              void (() => {
                console.log("Save triggered — sync engine coming in Phase 7")
              })()
            }}
          />
        </div>
      </div>
    </div>
  )
}
