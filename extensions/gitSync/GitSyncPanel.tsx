"use client"

/**
 * GitSyncPanel — the source-control sidebar for the user's notes folder.
 * VS-Code-inspired but calm and OpenNotes-styled: honest states, muted
 * chrome, git's own stderr surfaced verbatim on errors.
 */

import * as React from "react"
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  CloudDownload,
  CloudUpload,
  FolderGit2,
  GitBranch,
  GitCommit,
  MoreHorizontal,
  Plus,
  RefreshCw,
  X,
} from "lucide-react"

import type { OpenNotesExtensionAPI } from "@/core/extensions/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { GIT_SYNC_COPY as C } from "./copy"
import { SyncBanner } from "./SyncBanner"
import { useGitSync, type UseGitSyncOptions } from "./useGitSync"

interface GitSyncPanelProps {
  api: OpenNotesExtensionAPI
  /** Test seam: injected straight into useGitSync. Production panels omit it. */
  gitSyncOptions?: UseGitSyncOptions
}

/* ---------- Small shared bits ---------- */

function StateCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
      <Icon className="h-5 w-5 text-muted-foreground/70" />
      <p className="text-sm font-medium text-foreground/90">{title}</p>
      <div className="max-w-72 space-y-2 text-xs leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
      {children}
    </div>
  )
}

function InlineError({
  message,
  hint,
  onDismiss,
}: {
  message: string
  hint: string | null
  onDismiss: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs"
    >
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap break-words font-mono leading-relaxed text-foreground/90">
            {message}
          </p>
          {hint && <p className="mt-1.5 leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
        <button
          type="button"
          aria-label="Dismiss error"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function relativeDate(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ""
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

/* ---------- Panel ---------- */

export function GitSyncPanel({ api, gitSyncOptions }: GitSyncPanelProps) {
  const git = useGitSync(api, gitSyncOptions)

  const [message, setMessage] = React.useState("")
  const [addRemoteOpen, setAddRemoteOpen] = React.useState(false)
  const [branchCreateOpen, setBranchCreateOpen] = React.useState(false)
  const [remoteName, setRemoteName] = React.useState("")
  const [remoteUrl, setRemoteUrl] = React.useState("")
  const [newBranch, setNewBranch] = React.useState("")

  const onCommit = async () => {
    const ok = await git.commit(message)
    if (ok) setMessage("")
  }

  const onAddRemote = async () => {
    const ok = await git.addRemote(remoteName, remoteUrl)
    if (ok) {
      setRemoteName("")
      setRemoteUrl("")
      setAddRemoteOpen(false)
    }
  }

  const onCreateBranch = async () => {
    const ok = await git.createBranch(newBranch)
    if (ok) {
      setNewBranch("")
      setBranchCreateOpen(false)
    }
  }

  const status = git.status
  const hasUpstream = status !== null && (status.ahead > 0 || status.behind > 0 || git.remotes.length > 0)
  const changes = React.useMemo(() => {
    if (!status) return []
    const rows: Array<{ path: string; badge: string; tone: string; label: string }> = []
    for (const p of status.staged)
      rows.push({ path: p, badge: C.changes.badgeStaged, tone: "text-emerald-600 dark:text-emerald-400", label: "staged" })
    for (const p of status.modified)
      rows.push({ path: p, badge: C.changes.badgeModified, tone: "text-amber-600 dark:text-amber-400", label: "modified" })
    for (const p of status.untracked)
      rows.push({ path: p, badge: C.changes.badgeUntracked, tone: "text-muted-foreground", label: "untracked" })
    for (const p of status.conflicted)
      rows.push({ path: p, badge: C.changes.badgeConflicted, tone: "text-destructive", label: "conflicted" })
    return rows
  }, [status])

  /* ----- Gated states, in priority order ----- */

  if (git.phase === "not-tauri") {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
        <StateCard icon={FolderGit2} title={C.notTauri.title}>
          <p>{C.notTauri.body}</p>
          <p>{C.notTauri.reassurance}</p>
        </StateCard>
      </div>
    )
  }

  if (git.phase === "checking") {
    return (
      <div className="flex h-full items-center justify-center bg-background p-3">
        <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground/60" aria-label="Checking git" />
      </div>
    )
  }

  if (git.phase === "unavailable") {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
        <StateCard icon={AlertCircle} title={C.gitMissing.title}>
          <p>{C.gitMissing.body}</p>
          <p className="font-mono text-[11px]">{C.gitMissing.hint}</p>
          <p>
            <a
              href={C.gitMissing.linkHref}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {C.gitMissing.linkLabel}
            </a>
          </p>
        </StateCard>
      </div>
    )
  }

  if (git.phase === "no-identity") {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
        <StateCard icon={GitCommit} title={C.identityMissing.title}>
          <p>{C.identityMissing.body}</p>
          <p>
            <a
              href={C.identityMissing.linkHref}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {C.identityMissing.linkLabel}
            </a>
          </p>
        </StateCard>
      </div>
    )
  }

  if (git.phase === "no-folder") {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
        <StateCard icon={FolderGit2} title="Pick your notes folder">
          <p>Git Sync versions the folder your notes live in. Point it at that folder once.</p>
          <p>
            <Button size="sm" onClick={() => void git.pickFolder()} aria-label="Choose notes folder">
              Choose folder
            </Button>
          </p>
        </StateCard>
      </div>
    )
  }

  if (git.phase === "not-a-repo") {
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
        {git.error && (
          <InlineError message={git.error.message} hint={git.error.hint} onDismiss={git.dismissError} />
        )}
        <StateCard icon={FolderGit2} title={C.notARepo.title}>
          <p>{C.notARepo.body}</p>
          <p>
            <Button
              size="sm"
              disabled={git.busy}
              onClick={() => void git.initRepo()}
              aria-label={C.notARepo.initButton}
            >
              <GitBranch className="h-3.5 w-3.5" />
              {C.notARepo.initButton}
            </Button>
          </p>
          <p className="text-muted-foreground/80">{C.notARepo.initHint}</p>
        </StateCard>
      </div>
    )
  }

  /* ----- Normal (ready) state ----- */

  const openAddRemote = () => {
    setAddRemoteOpen(true)
    setBranchCreateOpen(false)
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto bg-background p-3">
      {/* Hero: what's synced to the remote, what isn't, and auto-sync. */}
      <SyncBanner git={git} onAddRemote={openAddRemote} />

      {/* Header: branch + ahead/behind + sync + refresh + overflow */}
      <div className="flex items-center gap-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={C.header.branchSwitcher}
            className="flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-foreground/90 outline-none transition-colors hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring"
          >
            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="max-w-28 truncate">{git.branches.current ?? status?.branch ?? "—"}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            {/* GroupLabel requires a Menu.Group parent — without one it throws
                ("MenuGroupRootContext is missing") and takes the app down when
                the menu opens. The label/aria-labelledby wiring is also the
                accessible group semantics base-ui intends here. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel>{C.branch.title}</DropdownMenuLabel>
              {git.branches.all.map((b) => (
                <DropdownMenuItem key={b} onClick={() => void git.checkoutBranch(b)}>
                  <Check
                    className={cn(
                      "h-3.5 w-3.5",
                      b === git.branches.current ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{b}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setBranchCreateOpen((v) => !v)
                setAddRemoteOpen(false)
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              New branch…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {status && (status.ahead > 0 || status.behind > 0) && (
          <span
            aria-label={`${status.ahead} ahead, ${status.behind} behind`}
            className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {status.ahead > 0 && (
              <span className="flex items-center gap-0.5">
                <ArrowUp className="h-3 w-3" />
                {status.ahead}
              </span>
            )}
            {status.behind > 0 && (
              <span className="flex items-center gap-0.5">
                <ArrowDown className="h-3 w-3" />
                {status.behind}
              </span>
            )}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {hasUpstream && (
            <Button
              size="sm"
              variant="ghost"
              disabled={git.busy}
              onClick={() => void git.push().then(() => git.pull())}
              aria-label={C.header.sync}
              title={C.header.sync}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", git.busy && "animate-spin")} />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={git.busy}
            onClick={() => void git.refreshForced()}
            aria-label={C.header.refresh}
            title={C.header.refresh}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={C.header.overflow}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuItem
                onClick={() => {
                  setAddRemoteOpen((v) => !v)
                  setBranchCreateOpen(false)
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                {C.remote.add}…
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void git.refreshForced()}>
                <RefreshCw className="h-3.5 w-3.5" />
                {C.header.refresh}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tracking line: which remote branch this branch publishes to. */}
      {status && (
        <p className="-mt-1.5 truncate px-1.5 text-[10px] text-muted-foreground/70">
          {status.upstream ? (
            <>
              {status.branch ?? "—"} → {status.upstream}
            </>
          ) : (
            "Not tracking a remote branch"
          )}
        </p>
      )}

      {branchCreateOpen && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void onCreateBranch()
          }}
        >
          <Input
            value={newBranch}
            onChange={(e) => setNewBranch(e.target.value)}
            placeholder={C.branch.createPlaceholder}
            aria-label={C.branch.createPlaceholder}
            className="h-7 text-xs"
            autoFocus
          />
          <Button type="submit" size="sm" variant="secondary" disabled={git.busy || !newBranch.trim()}>
            {C.branch.created}
          </Button>
        </form>
      )}

      {git.error && (
        <InlineError message={git.error.message} hint={git.error.hint} onDismiss={git.dismissError} />
      )}

      {/* Changes */}
      <section aria-label={C.changes.title} className="space-y-1.5">
        <SectionLabel>{C.changes.title}</SectionLabel>
        {changes.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
            {C.changes.empty}
          </p>
        ) : (
          <ul className="space-y-px">
            {changes.map((row) => (
              <li
                key={`${row.label}:${row.path}`}
                className="group flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/60"
              >
                <span
                  aria-label={row.label}
                  className={cn("w-3 shrink-0 text-center font-mono font-semibold", row.tone)}
                >
                  {row.badge}
                </span>
                <button
                  type="button"
                  onClick={() => api.openNote(row.path)}
                  className="min-w-0 flex-1 truncate text-left text-foreground/85 outline-none transition-colors hover:text-foreground focus-visible:underline"
                  title={row.path}
                >
                  {row.path}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Commit */}
      <section aria-label="Commit" className="space-y-1.5">
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void onCommit()
          }}
        >
          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={C.commit.placeholder}
            aria-label={C.commit.placeholder}
            className="h-8"
          />
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={git.busy || !message.trim()}
            aria-label={C.commit.button}
          >
            <GitCommit className="h-3.5 w-3.5" />
            {C.commit.button}
          </Button>
        </form>
      </section>

      {/* Push / Pull */}
      <section aria-label="Sync with remote" className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={git.busy || git.remotes.length === 0}
          onClick={() => void git.push()}
          aria-label={C.sync.push}
        >
          <CloudUpload className="h-3.5 w-3.5" />
          {C.sync.push}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={git.busy || git.remotes.length === 0}
          onClick={() => void git.pull()}
          aria-label={C.sync.pull}
        >
          <CloudDownload className="h-3.5 w-3.5" />
          {C.sync.pull}
        </Button>
      </section>

      {/* Add remote inline form */}
      {addRemoteOpen && (
        <form
          className="space-y-1.5 rounded-lg border border-border/60 bg-muted/20 p-2.5"
          onSubmit={(e) => {
            e.preventDefault()
            void onAddRemote()
          }}
        >
          <SectionLabel>{C.remote.add}</SectionLabel>
          <Input
            value={remoteName}
            onChange={(e) => setRemoteName(e.target.value)}
            placeholder={C.remote.namePlaceholder}
            aria-label="Remote name"
            className="h-7 text-xs"
            autoFocus
          />
          <Input
            value={remoteUrl}
            onChange={(e) => setRemoteUrl(e.target.value)}
            placeholder={C.remote.urlPlaceholder}
            aria-label="Remote URL"
            className="h-7 font-mono text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              className="flex-1"
              disabled={git.busy || !remoteName.trim() || !remoteUrl.trim()}
            >
              {C.remote.add}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setAddRemoteOpen(false)}
              aria-label="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </form>
      )}

      {/* Remotes */}
      <section aria-label={C.remote.title} className="space-y-1.5">
        <SectionLabel>{C.remote.title}</SectionLabel>
        {git.remotes.length === 0 ? (
          <p className="text-xs text-muted-foreground/80">{C.remote.empty}</p>
        ) : (
          <ul className="space-y-1">
            {git.remotes.map((r) => (
              <li key={r.name} className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-1.5">
                <div className="text-xs font-medium text-foreground/85">{r.name}</div>
                <div className="truncate font-mono text-[10px] text-muted-foreground" title={r.fetchUrl}>
                  {r.fetchUrl}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent commits */}
      <section aria-label={C.log.title} className="space-y-1.5 pb-2">
        <SectionLabel>{C.log.title}</SectionLabel>
        {git.commits.length === 0 ? (
          <p className="text-xs text-muted-foreground/80">{C.log.empty}</p>
        ) : (
          <ul className="space-y-px">
            {git.commits.map((c, i) => {
              // The first `status.ahead` log entries are local-only (not yet
              // pushed to the remote) — mark them so pushed vs local is visible.
              const localOnly = (status?.ahead ?? 0) > 0 && i < (status?.ahead ?? 0)
              return (
                <li
                  key={c.hash}
                  className="flex items-baseline gap-2 rounded-md px-2 py-1 text-xs transition-colors hover:bg-muted/60"
                >
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/80">
                    {c.shortHash}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-foreground/85" title={c.subject}>
                    {c.subject}
                  </span>
                  {localOnly && (
                    <span
                      aria-label="Local only — not pushed yet"
                      title="Local only — not pushed yet"
                      className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground/70"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500/80" />
                      local
                    </span>
                  )}
                  <span className="shrink-0 text-[10px] text-muted-foreground/70">
                    {relativeDate(c.date)}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default GitSyncPanel
