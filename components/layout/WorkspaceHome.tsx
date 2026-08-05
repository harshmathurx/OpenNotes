"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  BookOpen,
  Calendar,
  Layers,
  Clock,
  Plus,
  Trash2,
  ChevronRight,
  Sparkles,
  ChevronLeft,
} from "lucide-react"

interface WorkspaceHomeProps {
  files: Array<{ path: string; content: string; lastModified: Date }>
  onSelectFile: (path: string) => void
  onCreateFile: (name: string) => Promise<string>
  onSaveFile: (path: string, content: string) => Promise<void>
}

interface KanbanCard {
  id: string
  title: string
  column: "todo" | "progress" | "done"
}

export function WorkspaceHome({
  files,
  onSelectFile,
  onCreateFile,
  onSaveFile,
}: WorkspaceHomeProps) {
  // Scratchpad state — hydrate from localStorage via lazy initializer.
  const [scratchpad, setScratchpad] = useState<string>(() => {
    if (typeof window === "undefined") return ""
    return window.localStorage.getItem("opennotes-dashboard-scratch") ?? ""
  })

  // Kanban state — hydrate from localStorage, falling back to placeholders.
  const [kanbanCards, setKanbanCards] = useState<KanbanCard[]>(() => {
    const defaults: KanbanCard[] = [
      { id: "1", title: "Write weekly review note", column: "todo" },
      { id: "2", title: "Draft outline for blog post", column: "progress" },
      { id: "3", title: "Setup OpenNotes local sync", column: "done" },
    ]
    if (typeof window === "undefined") return defaults
    const saved = window.localStorage.getItem("opennotes-dashboard-kanban")
    if (!saved) {
      window.localStorage.setItem(
        "opennotes-dashboard-kanban",
        JSON.stringify(defaults)
      )
      return defaults
    }
    try {
      return JSON.parse(saved) as KanbanCard[]
    } catch (e) {
      console.error(e)
      return defaults
    }
  })
  const [newCardText, setNewCardText] = useState("")
  const [activeColumn, setActiveColumn] = useState<"todo" | "progress" | "done">("todo")

  // Save Scratchpad
  const handleScratchChange = (val: string) => {
    setScratchpad(val)
    localStorage.setItem("opennotes-dashboard-scratch", val)
  }

  // Save Kanban helper
  const saveKanban = (cards: KanbanCard[]) => {
    setKanbanCards(cards)
    localStorage.setItem("opennotes-dashboard-kanban", JSON.stringify(cards))
  }

  // Add Kanban Card
  const addKanbanCard = () => {
    const title = newCardText.trim()
    if (!title) return
    const newCard: KanbanCard = {
      id: Date.now().toString(),
      title,
      column: activeColumn,
    }
    const updated = [...kanbanCards, newCard]
    saveKanban(updated)
    setNewCardText("")
  }

  // Delete Kanban Card
  const deleteKanbanCard = (id: string) => {
    const updated = kanbanCards.filter((c) => c.id !== id)
    saveKanban(updated)
  }

  // Move Kanban Card
  const moveCard = (id: string, direction: "next" | "prev") => {
    const updated = kanbanCards.map((c) => {
      if (c.id !== id) return c
      let nextCol: "todo" | "progress" | "done" = c.column
      if (c.column === "todo" && direction === "next") nextCol = "progress"
      else if (c.column === "progress") {
        nextCol = direction === "next" ? "done" : "todo"
      } else if (c.column === "done" && direction === "prev") nextCol = "progress"
      return { ...c, column: nextCol }
    })
    saveKanban(updated)
  }

  // Daily Journal Trigger
  const launchDailyJournal = async () => {
    const todayStr = new Date().toISOString().split("T")[0] // YYYY-MM-DD
    const journalPath = `Journal/${todayStr}.md`

    // Check if journal file exists
    const existing = files.find((f) => f.path === journalPath)
    if (existing) {
      onSelectFile(journalPath)
      return
    }

    // Create new journal with structured markdown
    const formattedDate = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

    const template = `# Journal — ${formattedDate}

## Daily Focus
- [ ] _Set a primary target for today_

## Schedule & Tasks
- [ ] Write 3 priority tasks
- [ ] Midday review

## Logs & Daily Observations
- _Start capturing notes here..._
`
    const path = await onCreateFile(journalPath)
    await onSaveFile(path, template)
    onSelectFile(path)
  }

  // Get 3 most recently modified files
  const recentFiles = [...files]
    .sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
    .slice(0, 3)

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-background to-muted/20 p-8 md:p-12 transition-colors duration-300">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Workspace Greeting */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              Workspace Hub
              <Sparkles className="h-5 w-5 text-violet-500 animate-pulse" />
            </h1>
            <p className="text-sm text-muted-foreground">
              A private, local-first place for your thoughts and projects.
            </p>
          </div>
          <Button
            onClick={launchDailyJournal}
            size="lg"
            className="font-semibold shadow-md bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white gap-2 border-0"
          >
            <Calendar className="h-4.5 w-4.5" />
            Start Daily Journal
          </Button>
        </div>

        {/* Dashboard Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Recent Notes Card */}
          <div className="lg:col-span-1 rounded-xl border border-border/80 bg-background/50 p-5 shadow-sm backdrop-blur-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <Clock className="h-4.5 w-4.5 text-muted-foreground" />
                <span>Recent Documents</span>
              </div>
              <div className="space-y-2">
                {recentFiles.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4">
                    Your recent notes will appear here.
                  </p>
                ) : (
                  recentFiles.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => onSelectFile(file.path)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/40 bg-background/80 hover:bg-accent/50 px-3 py-2 text-left text-xs transition-all duration-200"
                    >
                      <span className="truncate font-semibold text-foreground/80">
                        {file.path}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="pt-4 border-t border-border/40 mt-4">
              <p className="text-[10px] text-muted-foreground">
                Total notes: <span className="font-bold text-foreground">{files.length}</span>
              </p>
            </div>
          </div>

          {/* Quick Scratchpad Card */}
          <div className="lg:col-span-2 rounded-xl border border-border/80 bg-background/50 p-5 shadow-sm backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                <BookOpen className="h-4.5 w-4.5 text-muted-foreground" />
                <span>Instant Scratchpad</span>
              </div>
              <span className="text-[10px] bg-violet-500/10 text-violet-600 px-2 py-0.5 rounded-full font-semibold border border-violet-500/20">
                Auto-saved
              </span>
            </div>
            <Textarea
              value={scratchpad}
              onChange={(e) => handleScratchChange(e.target.value)}
              placeholder="Dump temporary thoughts, lists, or links here. This scratchpad exists independently of your notes and keeps the sidebar clean."
              className="min-h-[140px] resize-none border-border/60 bg-background/80 focus:bg-background text-xs leading-relaxed"
            />
          </div>

        </div>

        {/* Local Kanban Board Board */}
        <div className="rounded-xl border border-border/80 bg-background/50 p-6 shadow-sm backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <Layers className="h-4.5 w-4.5 text-muted-foreground" />
              <span>Project Kanban Board</span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={activeColumn}
                onChange={(e) =>
                  setActiveColumn(e.target.value as "todo" | "progress" | "done")
                }
                className="bg-background border border-border/80 rounded px-2 py-1 text-xs outline-none"
              >
                <option value="todo">To Do</option>
                <option value="progress">In Progress</option>
                <option value="done">Done</option>
              </select>
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="New task title..."
                  value={newCardText}
                  onChange={(e) => setNewCardText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addKanbanCard()
                  }}
                  className="bg-background border border-border/80 rounded px-2 py-1 text-xs w-48 pr-8 outline-none"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addKanbanCard}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* TO DO column */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1 uppercase tracking-wider">
                <span>To Do</span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-extrabold text-foreground/75">
                  {kanbanCards.filter((c) => c.column === "todo").length}
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {kanbanCards.filter((c) => c.column === "todo").map((card) => (
                  <div
                    key={card.id}
                    className="group rounded-md border border-border/60 bg-background p-2.5 shadow-sm text-xs space-y-2 hover:border-primary/40 transition-colors duration-200"
                  >
                    <p className="font-semibold text-foreground/80">{card.title}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-border/20 opacity-90">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKanbanCard(card.id)}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCard(card.id, "next")}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* IN PROGRESS column */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1 uppercase tracking-wider">
                <span>In Progress</span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-extrabold text-foreground/75">
                  {kanbanCards.filter((c) => c.column === "progress").length}
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {kanbanCards.filter((c) => c.column === "progress").map((card) => (
                  <div
                    key={card.id}
                    className="group rounded-md border border-border/60 bg-background p-2.5 shadow-sm text-xs space-y-2 hover:border-primary/40 transition-colors duration-200"
                  >
                    <p className="font-semibold text-foreground/80">{card.title}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-border/20 opacity-90">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCard(card.id, "prev")}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKanbanCard(card.id)}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCard(card.id, "next")}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DONE column */}
            <div className="rounded-lg bg-muted/30 p-3 border border-border/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1 uppercase tracking-wider">
                <span>Done</span>
                <span className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-extrabold text-foreground/75">
                  {kanbanCards.filter((c) => c.column === "done").length}
                </span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {kanbanCards.filter((c) => c.column === "done").map((card) => (
                  <div
                    key={card.id}
                    className="group rounded-md border border-border/60 bg-background p-2.5 shadow-sm text-xs space-y-2 hover:border-primary/40 transition-colors duration-200 line-through decoration-muted-foreground/60 opacity-80"
                  >
                    <p className="font-semibold text-muted-foreground">{card.title}</p>
                    <div className="flex justify-between items-center pt-1 border-t border-border/20 opacity-90">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => moveCard(card.id, "prev")}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteKanbanCard(card.id)}
                        className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
