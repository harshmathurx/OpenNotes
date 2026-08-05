"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"
import { Sidebar } from "./Sidebar"
import { TitleBar } from "./TitleBar"
import { SyncStatusIndicator } from "./SyncStatus"
import { WorkspaceHome } from "./WorkspaceHome"
import { PanelHost, getPersistedActivePanel, persistActivePanel } from "./PanelHost"
import { TiptapEditor, type TiptapEditorHandle } from "../editor/TiptapEditor"
import { CommandPalette } from "../palette/CommandPalette"
import { SettingsModal } from "../modals/SettingsModal"
import { ExtensionsModal } from "../modals/ExtensionsModal"
import { AIOptionsDialog } from "../modals/AIOptionsDialog"
import { useVault } from "@/hooks/useVault"
import { useNotesFolderActions } from "@/hooks/useNotesFolderActions"
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow"
import { useExtensions } from "@/hooks/useExtensions"
import { flushAllVaultSaves } from "@/core/vault/mutations"
import { getNotesFolder } from "@/core/vault/notesFolder"
import { useAISettings } from "@/hooks/useAISettings"
import { streamAICoWriter } from "@/core/ai/stream"
import { initInstallListener } from "@/core/registry/installListener"
import { loadCommunityExtensions } from "@/core/registry/communityLoader"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Plus, FileText, FolderOpen } from "lucide-react"

export function AppShell() {
  const {
    files,
    activeFile,
    setActiveFile,
    createFile,
    saveFile,
    renameFile,
    deleteFile,
  } = useVault()
  const { activeKey, provider, ollamaUrl } = useAISettings()
  const { pickNotesFolder, isDesktop } = useNotesFolderActions()

  // First-run onboarding: shown until the user completes it (flag persisted).
  // Hydrated after mount to avoid an SSR/client mismatch (localStorage is
  // only available client-side); until mounted we treat onboarding as done so
  // server and first client render agree.
  // null = not yet hydrated → render the stable shell so server and first
  // client render agree; the flag is read once after mount.
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null)

  useEffect(() => {
    let done = true
    try {
      done =
        window.localStorage.getItem("opennotes-onboarding-complete") === "true"
    } catch {
      done = true
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount hydration of the onboarding flag
    setOnboardingDone(done)
  }, [])

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const [zenMode, setZenMode] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [extensionsOpen, setExtensionsOpen] = useState(false)
  const [aiOptionsOpen, setAiOptionsOpen] = useState(false)
  const [view, setView] = useState<"editor" | "home">("editor")
  const [activePanelId, setActivePanelId] = useState<string | null>(() =>
    getPersistedActivePanel()
  )

  const editorRef = useRef<TiptapEditorHandle>(null)

  // Persist the active panel whenever it changes.
  useEffect(() => {
    persistActivePanel(activePanelId)
  }, [activePanelId])

  const activeContent = files.find((f) => f.path === activeFile)?.content ?? ""
  const isHome = view === "home"

  // Mirror the live active file + content into refs so extension handlers
  // always act on the CURRENT note, even when they run in the same event turn
  // that changed it (e.g. createNote() then setActiveNoteContent() back-to-back
  // would otherwise overwrite the PREVIOUS note via a stale closure).
  const activeFileRef = useRef(activeFile)
  const activeContentRef = useRef(activeContent)
  useEffect(() => {
    activeFileRef.current = activeFile
    activeContentRef.current = activeContent
  }, [activeFile, activeContent])

  // ----- Editor <-> extension bridge handlers -----
  const getActiveNote = useCallback(() => {
    const path = activeFileRef.current
    if (!path || isHome) return null
    return { path, content: activeContentRef.current }
  }, [isHome])

  const getNotes = useCallback(
    () => files.map((f) => ({ path: f.path, content: f.content })),
    [files]
  )

  const openNote = useCallback(
    (path: string) => {
      setView("editor")
      setActiveFile(path)
    },
    [setActiveFile]
  )

  const createNote = useCallback(
    async (name?: string) => {
      const path = await createFile(name)
      // Update the live ref SYNCHRONOUSLY so an immediately-following handler
      // (e.g. a template's setActiveNoteContent) targets the NEW note, not the
      // previous one — React state (and the ref-sync effect) only catches up on
      // the next render, which is too late for same-turn callers.
      if (path) {
        activeFileRef.current = path
        activeContentRef.current = ""
      }
      setView("editor")
      return path ?? null
    },
    [createFile]
  )

  const insertIntoActiveNote = useCallback(
    (markdown: string) => {
      const path = activeFileRef.current
      if (editorRef.current && !isHome) {
        editorRef.current.insertMarkdown(markdown)
      } else if (path && !isHome) {
        void saveFile(path, activeContentRef.current + markdown)
      }
    },
    [isHome, saveFile]
  )

  const getSelection = useCallback(
    () => editorRef.current?.getSelection() ?? "",
    []
  )

  const replaceSelection = useCallback((markdown: string) => {
    editorRef.current?.replaceSelection(markdown)
  }, [])

  const setActiveNoteContent = useCallback(
    (markdown: string) => {
      const path = activeFileRef.current
      if (path && !isHome) {
        void saveFile(path, markdown)
        editorRef.current?.setMarkdown(markdown)
      }
    },
    [isHome, saveFile]
  )

  const showToast = useCallback((message: string) => {
    toast(message)
  }, [])

  const ai = useMemo(
    () => ({
      available: () => provider === "ollama" || activeKey !== "",
      complete: (prompt: string, options?: { system?: string }) =>
        new Promise<string>((resolve, reject) => {
          let acc = ""
          streamAICoWriter({
            provider,
            apiKey: activeKey,
            ollamaUrl,
            prompt,
            systemPrompt: options?.system,
            onChunk: (c) => {
              acc += c
            },
            onError: (e) => reject(new Error(e)),
            onDone: () => resolve(acc),
          })
        }),
    }),
    [provider, activeKey, ollamaUrl]
  )

  const {
    commands,
    panels,
    runCommand,
    getAPI,
  } = useExtensions({
    getActiveNote,
    getNotes,
    openNote,
    createNote,
    getSelection,
    replaceSelection,
    insertIntoActiveNote,
    setActiveNoteContent,
    showToast,
    ai,
  })

  // ----- Community extensions: load installed modules + listen for installs -----
  useEffect(() => {
    void loadCommunityExtensions()
    const cleanup = initInstallListener({ showToast: (m) => toast(m) })
    return cleanup
  }, [])

  // ----- Global listeners: AI settings event -----
  useEffect(() => {
    const aiSettingsHandler = () => setAiOptionsOpen(true)
    window.addEventListener("open-ai-settings", aiSettingsHandler)
    return () => {
      window.removeEventListener("open-ai-settings", aiSettingsHandler)
    }
  }, [])

  // ----- Keyboard shortcuts -----
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === "k") {
        e.preventDefault()
        setCommandOpen((prev) => !prev)
        return
      }
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault()
        setZenMode((prev) => !prev)
        return
      }
      if (mod && e.key === "n") {
        e.preventDefault()
        setView("editor")
        void createFile()
        return
      }
      if (mod && e.shiftKey && (e.key === "h" || e.key === "H")) {
        e.preventDefault()
        setView((prev) => (prev === "home" ? "editor" : "home"))
        return
      }
      if (mod && e.key === ",") {
        e.preventDefault()
        setSettingsOpen((prev) => !prev)
        return
      }
      if (e.key === "Escape") {
        if (commandOpen) {
          setCommandOpen(false)
          return
        }
        if (zenMode) {
          setZenMode(false)
          return
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [commandOpen, zenMode, createFile, setActiveFile])

  // Cmd+S / explicit save: land every queued vault write immediately so the
  // note on disk (or in the cache) is current. Notes autosave continuously;
  // this only forces pending writes to flush now.
  const handleSave = useCallback(() => {
    void flushAllVaultSaves()
  }, [])

  const goHome = useCallback(() => setView("home"), [])

  // Pick a notes folder from disk (native picker in the Mac app; in the
  // browser pickNotesFolder explains that folders work best on Mac).
  const handleOpenFolder = useCallback(() => {
    void pickNotesFolder()
  }, [pickNotesFolder])

  // Open the Git Sync extension panel (source control for the notes folder).
  const handleOpenGitSync = useCallback(() => {
    setSettingsOpen(false)
    setActivePanelId("git-sync:git-sync")
  }, [])

  // Basename of the notes folder for display, or null when none is set.
  const notesFolderName = useMemo(() => {
    const folder = getNotesFolder()
    if (!folder) return null
    const segments = folder.split(/[\\/]/).filter(Boolean)
    return segments[segments.length - 1] ?? folder
  }, [])

  // ----- Onboarding completion -----
  const completeOnboarding = useCallback(() => {
    try {
      window.localStorage.setItem("opennotes-onboarding-complete", "true")
    } catch {
      // non-fatal
    }
    setOnboardingDone(true)
  }, [])

  // Local path / skip: create the first note and finish onboarding.
  const handleOnboardingStartWriting = useCallback(() => {
    completeOnboarding()
    void createFile()
  }, [completeOnboarding, createFile])

  // Folder / folder+git path: the folder is already set by pickNotesFolder
  // inside the flow; just finish onboarding (the vault reconciles on its own).
  const handleOnboardingFolderChosen = useCallback(() => {
    completeOnboarding()
  }, [completeOnboarding])

  // ----- First-run onboarding gate -----
  if (onboardingDone === false && files.length === 0) {
    return (
      <OnboardingFlow
        isDesktop={isDesktop}
        pickNotesFolder={pickNotesFolder}
        onStartWriting={handleOnboardingStartWriting}
        onFolderChosen={handleOnboardingFolderChosen}
      />
    )
  }

  // ----- First-run empty state (onboarding done, no notes yet) -----
  if (files.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background transition-colors duration-300">
        <div className="flex flex-col items-center gap-6 px-4 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-medium text-foreground">
              Start writing
            </h1>
            <p className="max-w-xs text-sm text-muted-foreground">
              Create your first note. Everything is saved locally in your
              browser — no account, no server.
            </p>
          </div>
          <Button onClick={() => void createFile()} className="gap-2">
            <Plus className="h-4 w-4" />
            Create first note
          </Button>
          <p className="text-xs text-muted-foreground">
            Press{" "}
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              Ctrl+N
            </kbd>{" "}
            to create a note
          </p>
          <Button
            variant="outline"
            onClick={handleOpenFolder}
            className="gap-2"
          >
            <FolderOpen className="h-4 w-4" />
            Connect a notes folder
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {!zenMode && sidebarOpen && (
        <div className="hidden h-full md:block">
          <Sidebar
            files={files}
            activeFile={activeFile}
            onSelect={(path) => {
              setView("editor")
              setActiveFile(path)
            }}
            onCreate={() => {
              setView("editor")
              void createFile()
            }}
            onDelete={(path) => void deleteFile(path)}
            onOpenHome={goHome}
            isHomeActive={isHome}
          />
        </div>
      )}

      <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
        <SheetContent side="left" className="w-[280px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Files</SheetTitle>
          </SheetHeader>
          <Sidebar
            files={files}
            activeFile={activeFile}
            onSelect={(path) => {
              setView("editor")
              setActiveFile(path)
              setMobileSheetOpen(false)
            }}
            onCreate={() => {
              setView("editor")
              void createFile()
              setMobileSheetOpen(false)
            }}
            onDelete={(path) => void deleteFile(path)}
            onOpenHome={() => {
              goHome()
              setMobileSheetOpen(false)
            }}
            isHomeActive={isHome}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        {!zenMode && (
          <TitleBar
            path={isHome ? null : activeFile}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            onToggleMobileSidebar={() => setMobileSheetOpen(true)}
            onToggleZen={() => setZenMode(true)}
            onOpenSettings={() => setSettingsOpen(true)}
            onOpenExtensions={() => setExtensionsOpen(true)}
            onOpenAI={() => setAiOptionsOpen(true)}
            onRename={(newPath) => {
              if (activeFile && !isHome) void renameFile(activeFile, newPath)
            }}
            homeActive={isHome}
          >
            <SyncStatusIndicator onSync={handleSave} />
          </TitleBar>
        )}

        {zenMode && (
          <div className="absolute top-0 right-0 left-0 z-50 flex h-10 items-center justify-center opacity-0 transition-opacity duration-200 hover:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZenMode(false)}
              className="text-xs text-muted-foreground"
            >
              Exit zen mode
            </Button>
          </div>
        )}

        <div className="flex min-w-0 flex-1 overflow-hidden">
          <div className="min-w-0 flex-1 overflow-hidden">
            {isHome ? (
              <WorkspaceHome
                files={files.map((f) => ({
                  path: f.path,
                  content: f.content,
                  lastModified: f.lastModified,
                }))}
                onSelectFile={(path) => {
                  setView("editor")
                  setActiveFile(path)
                }}
                onCreateFile={async (name) => {
                  const p = await createFile(name)
                  setView("editor")
                  return p
                }}
                onSaveFile={saveFile}
              />
            ) : (
              <TiptapEditor
                key={activeFile ?? "none"}
                ref={editorRef}
                docKey={activeFile ?? "none"}
                content={activeContent}
                onChange={(content) => {
                  if (activeFile) saveFile(activeFile, content)
                }}
                onSave={handleSave}
                onNavigate={setActiveFile}
              />
            )}
          </div>

          {!zenMode && (
            <PanelHost
              panels={panels}
              getAPI={getAPI}
              activePanelId={activePanelId}
              onActivePanelChange={setActivePanelId}
            />
          )}
        </div>
      </div>

      {commandOpen && (
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          files={files}
          onSelectFile={(path) => {
            setView("editor")
            setActiveFile(path)
          }}
          onCreateFile={createFile}
          onSync={handleSave}
          onOpenHome={goHome}
          onOpenExtensions={() => setExtensionsOpen(true)}
          onOpenFolder={handleOpenFolder}
          onSwitchFolder={handleOpenFolder}
          extensionCommands={commands}
          onRunExtensionCommand={(id) => void runCommand(id)}
        />
      )}

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        notesFolderName={notesFolderName}
        isDesktop={isDesktop}
        onOpenGitSync={handleOpenGitSync}
        onChangeFolder={handleOpenFolder}
        onOpenExtensions={() => {
          setSettingsOpen(false)
          setExtensionsOpen(true)
        }}
        onOpenAI={() => {
          setSettingsOpen(false)
          setAiOptionsOpen(true)
        }}
      />

      <ExtensionsModal
        open={extensionsOpen}
        onClose={() => setExtensionsOpen(false)}
      />

      <AIOptionsDialog
        open={aiOptionsOpen}
        onClose={() => setAiOptionsOpen(false)}
      />
    </div>
  )
}
