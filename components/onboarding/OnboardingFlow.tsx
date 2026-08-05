"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  FolderOpen,
  GitBranch,
  HardDrive,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ONBOARDING_COPY as C } from "./copy"

/**
 * OnboardingFlow — first-run flow per docs/onboarding.md.
 *
 * Two doors on Screen 0 ("Start writing" skips everything; "Set up how you
 * work" opens a one-decision-per-screen setup). The host owns persistence:
 * this component never writes the "opennotes-onboarding-complete" flag — it
 * only calls the callbacks at the moments the spec defines.
 */

export interface OnboardingFlowProps {
  /** Local path finished (or Screen 0 skip) — host creates first note + sets the flag. */
  onStartWriting: () => void
  /** A folder (or folder+git) path was confirmed — host sets the flag + proceeds. */
  onFolderChosen: () => void
  /** From the host (isTauri()). */
  isDesktop: boolean
  /** From useNotesFolderActions; resolves the picked path or null on cancel. */
  pickNotesFolder: () => Promise<string | null>
}

type Screen =
  | "welcome"
  | "choose"
  | "config-local"
  | "config-folder"
  | "config-git"
  | "done"

type PathChoice = "local" | "folder" | "git"

const CARD_ORDER: PathChoice[] = ["local", "folder", "git"]

const CARD_ICONS: Record<PathChoice, typeof HardDrive> = {
  local: HardDrive,
  folder: FolderOpen,
  git: GitBranch,
}

/** Last path segment, tolerating both macOS "/" and stray "\" separators. */
function folderName(path: string): string {
  const segments = path.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] ?? path
}

function isPrimaryClick(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLButtonElement && target.dataset.primary === "true"
  )
}

export function OnboardingFlow({
  onStartWriting,
  onFolderChosen,
  isDesktop,
  pickNotesFolder,
}: OnboardingFlowProps) {
  const [screen, setScreen] = useState<Screen>("welcome")
  const [choice, setChoice] = useState<PathChoice>("local")
  const [folderPath, setFolderPath] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  // Section 5.4 — web user continued on a folder card: honest note, not a block.
  const [webNote, setWebNote] = useState(false)

  const headlineRef = useRef<HTMLHeadingElement>(null)
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Move focus to the headline on every screen transition (spec 5.6).
  useEffect(() => {
    headlineRef.current?.focus()
  }, [screen])

  const goBack = useCallback(() => {
    setWebNote(false)
    setScreen((s) =>
      s === "choose"
        ? "welcome"
        : s === "config-local" || s === "config-folder" || s === "config-git"
          ? "choose"
          : s
    )
  }, [])

  // Escape acts as "Back" on Screens 1–2; Enter activates the primary action
  // when focus isn't already on a button (spec 5.6).
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (screen !== "welcome" && screen !== "done") {
          e.preventDefault()
          goBack()
        }
        return
      }
      if (e.key === "Enter" && !isPrimaryClick(e.target)) {
        const primary = e.currentTarget.querySelector<HTMLButtonElement>(
          '[data-primary="true"]'
        )
        if (primary && !primary.disabled) {
          e.preventDefault()
          primary.click()
        }
      }
    },
    [screen, goBack]
  )

  const continueFromChoose = useCallback(() => {
    if (!isDesktop && choice !== "local") {
      // Honest note, stay on the screen — never stranded (spec 5.4).
      setWebNote(true)
      return
    }
    setScreen(
      choice === "local"
        ? "config-local"
        : choice === "folder"
          ? "config-folder"
          : "config-git"
    )
  }, [choice, isDesktop])

  const handlePickFolder = useCallback(async () => {
    setPicking(true)
    try {
      const path = await pickNotesFolder()
      // null = cancelled — a neutral act. Stay exactly as we were (spec 5.3).
      if (path) setFolderPath(path)
    } finally {
      setPicking(false)
    }
  }, [pickNotesFolder])

  // Screen 1 cards are a real radiogroup with arrow-key selection (spec 5.6).
  const handleCardKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      let next = -1
      if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (index + 1) % 3
      else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (index + 2) % 3
      else if (e.key === "Home") next = 0
      else if (e.key === "End") next = 2
      if (next === -1) return
      e.preventDefault()
      const nextChoice = CARD_ORDER[next]
      setChoice(nextChoice)
      setWebNote(false)
      cardRefs.current[next]?.focus()
    },
    []
  )

  const selectCard = useCallback((c: PathChoice) => {
    setChoice(c)
    setWebNote(false)
  }, [])

  const name = folderPath ? folderName(folderPath) : ""
  const donePathLine =
    choice === "local"
      ? C.done.pathLine.local
      : choice === "folder"
        ? C.done.pathLine.folder(name)
        : C.done.pathLine.git(name)

  return (
    <div
      className="flex h-screen flex-col items-center overflow-y-auto bg-background"
      onKeyDown={handleKeyDown}
    >
      <div
        key={screen}
        className="flex min-h-full w-full flex-col items-center justify-center px-6 py-12 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      >
        {screen === "welcome" && (
          <ScreenColumn width="max-w-[480px]">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-3">
              <Headline ref={headlineRef} text={C.welcome.headline} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {C.welcome.subline}
              </p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2.5">
              <Button
                data-primary
                size="lg"
                className="w-full"
                onClick={onStartWriting}
                aria-label={C.welcome.primary}
              >
                {C.welcome.primary}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                onClick={() => setScreen("choose")}
                aria-label={C.welcome.secondary}
              >
                {C.welcome.secondary}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground/80">
              {C.welcome.caption}
            </p>
          </ScreenColumn>
        )}

        {screen === "choose" && (
          <ScreenColumn width="max-w-[640px]">
            <StepDots step={1} />
            <div className="space-y-3">
              <Headline ref={headlineRef} text={C.choose.headline} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {C.choose.subline}
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label={C.choose.headline}
              className="grid w-full gap-3 sm:grid-cols-3"
            >
              {CARD_ORDER.map((cardId, i) => {
                const card = C.choose.cards[cardId]
                const Icon = CARD_ICONS[cardId]
                const selected = choice === cardId
                return (
                  <button
                    key={cardId}
                    ref={(el) => {
                      cardRefs.current[i] = el
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectCard(cardId)}
                    onKeyDown={(e) => handleCardKeyDown(e, i)}
                    className={cn(
                      "flex h-full flex-col gap-2.5 rounded-xl border p-4 text-left outline-none transition-colors",
                      "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      selected
                        ? "border-primary/50 bg-accent/40"
                        : "border-border bg-background hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Icon
                        className={cn(
                          "h-4.5 w-4.5",
                          selected ? "text-foreground" : "text-muted-foreground"
                        )}
                        aria-hidden
                      />
                      {card.badge && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {card.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {card.title}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {card.body}
                    </p>
                    <p className="mt-auto text-xs text-muted-foreground/70">
                      {card.forLine}
                    </p>
                  </button>
                )
              })}
            </div>
            {webNote && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  {C.choose.webNote}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {C.choose.webSafeLine}
                </p>
              </div>
            )}
            <p className="text-xs text-muted-foreground/80">
              {C.choose.reassurance}
            </p>
            <div className="flex flex-col items-center gap-1">
              <Button
                data-primary
                size="lg"
                className="w-full max-w-xs gap-2"
                onClick={continueFromChoose}
                aria-label={C.choose.continue}
              >
                {C.choose.continue}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
              <BackButton onClick={goBack} label={C.choose.back} />
            </div>
          </ScreenColumn>
        )}

        {screen === "config-local" && (
          <ScreenColumn width="max-w-[480px]">
            <StepDots step={2} />
            <div className="space-y-3">
              <Headline ref={headlineRef} text={C.configLocal.headline} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {C.configLocal.body1}
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {C.configLocal.body2}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Button
                data-primary
                size="lg"
                className="w-full max-w-xs"
                onClick={onStartWriting}
                aria-label={C.configLocal.primary}
              >
                {C.configLocal.primary}
              </Button>
              <BackButton onClick={goBack} label={C.configLocal.back} />
            </div>
          </ScreenColumn>
        )}

        {(screen === "config-folder" || screen === "config-git") && (
          <ScreenColumn width="max-w-[480px]">
            <StepDots step={2} />
            <div className="space-y-3">
              <Headline
                ref={headlineRef}
                text={
                  screen === "config-folder"
                    ? C.configFolder.headline
                    : C.configGit.headline
                }
              />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {screen === "config-folder"
                  ? C.configFolder.body
                  : C.configGit.body}
              </p>
            </div>

            {folderPath ? (
              <div className="w-full space-y-2">
                <p className="text-xs text-muted-foreground">
                  {screen === "config-folder"
                    ? C.configFolder.afterPickLabel
                    : C.configGit.afterPickLabel}
                </p>
                <p
                  title={folderPath}
                  className="w-full truncate rounded-md border border-border bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-muted-foreground"
                >
                  {folderPath}
                </p>
                {screen === "config-folder" && (
                  <p className="text-sm text-foreground">
                    {C.configFolder.afterPickFriendly(name)}
                  </p>
                )}
              </div>
            ) : null}

            {screen === "config-git" && (
              <div className="w-full space-y-2.5 rounded-xl border border-border bg-muted/30 p-4 text-left">
                <p className="text-xs font-medium text-foreground">
                  {C.configGit.explainerTitle}
                </p>
                <ul className="space-y-2">
                  {C.configGit.explainer.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"
                    >
                      <Check
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70"
                        aria-hidden
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col items-center gap-1">
              {folderPath ? (
                <Button
                  data-primary
                  size="lg"
                  className="w-full max-w-xs gap-2"
                  onClick={() => setScreen("done")}
                  aria-label={
                    screen === "config-folder"
                      ? C.configFolder.continue
                      : C.configGit.continue
                  }
                >
                  {screen === "config-folder"
                    ? C.configFolder.continue
                    : C.configGit.continue}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <Button
                  data-primary
                  size="lg"
                  className="w-full max-w-xs gap-2"
                  disabled={picking}
                  onClick={() => void handlePickFolder()}
                  aria-label={
                    screen === "config-folder"
                      ? C.configFolder.pick
                      : C.configGit.pick
                  }
                >
                  <FolderOpen className="h-4 w-4" aria-hidden />
                  {screen === "config-folder"
                    ? C.configFolder.pick
                    : C.configGit.pick}
                </Button>
              )}
              <BackButton
                onClick={goBack}
                label={
                  screen === "config-folder"
                    ? C.configFolder.back
                    : C.configGit.back
                }
              />
            </div>
          </ScreenColumn>
        )}

        {screen === "done" && (
          <ScreenColumn width="max-w-[480px]">
            <StepDots step={3} />
            <div className="space-y-3">
              <Headline ref={headlineRef} text={C.done.headline} />
              <p className="text-sm leading-relaxed text-muted-foreground">
                {donePathLine}
              </p>
            </div>
            <ul className="w-full space-y-2.5 text-left">
              {C.done.items.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"
                >
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-xs leading-relaxed text-muted-foreground/80">
              {C.done.aiPointer}
            </p>
            <Button
              data-primary
              size="lg"
              className="w-full max-w-xs"
              onClick={choice === "local" ? onStartWriting : onFolderChosen}
              aria-label={
                choice === "local" ? C.done.primaryLocal : C.done.primaryFolder
              }
            >
              {choice === "local" ? C.done.primaryLocal : C.done.primaryFolder}
            </Button>
          </ScreenColumn>
        )}
      </div>
    </div>
  )
}

/* ---------- building blocks ---------- */

function ScreenColumn({
  width,
  children,
}: {
  width: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-7 text-center",
        width
      )}
    >
      {children}
    </div>
  )
}

function Headline({
  ref,
  text,
}: {
  ref: React.Ref<HTMLHeadingElement>
  text: string
}) {
  return (
    <h1
      ref={ref}
      tabIndex={-1}
      className="text-xl font-medium tracking-tight text-foreground outline-none"
    >
      {text}
    </h1>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground"
      onClick={onClick}
      aria-label={label}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}

/** Quiet three-dot step progression — calmer than a numeric "1 of 3". */
function StepDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div
      aria-hidden
      className="flex items-center gap-1.5"
    >
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            i <= step ? "bg-muted-foreground/60" : "bg-muted-foreground/20"
          )}
        />
      ))}
    </div>
  )
}
