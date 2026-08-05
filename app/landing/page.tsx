import {
  ArrowRight,
  Download,
  FolderOpen,
  GitFork,
  Palette,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/Logo"

export default function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div aria-hidden className="landing-grain" />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border/70 bg-card">
            <Logo size={16} className="text-foreground" />
          </span>
          <span className="text-sm font-semibold tracking-tight">
            OpenNotes
          </span>
        </div>
        <a
          href="https://github.com/harshmathurx/OpenNotes"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <GitFork className="h-4 w-4" />
          <span className="hidden sm:inline">GitHub</span>
        </a>
      </header>

      {/* Hero */}
      <section className="landing-hero-bg relative px-6 pt-16 pb-20 md:pt-28 md:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="landing-fade-up mb-7 text-[11px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
            OpenNotes
          </p>
          <h1 className="landing-fade-up landing-fade-up-1 mb-6 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-5xl md:text-6xl">
            Your notes. Real files. Your storage. Your&nbsp;AI.
          </h1>
          <p className="landing-fade-up landing-fade-up-2 mx-auto mb-10 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A calm, local-first markdown workspace. Plain text you can grep,
            sync, and keep — no accounts, no lock-in, no noise.
          </p>
          <div className="landing-fade-up landing-fade-up-3 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/"
              className="group inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-7 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Start writing
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
            <a
              href="https://github.com/harshmathurx/OpenNotes/releases"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border px-7 text-sm font-medium text-foreground transition-colors duration-200 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Download className="h-4 w-4" />
              Download for Mac
            </a>
            <a
              href="https://github.com/harshmathurx/OpenNotes"
              target="_blank"
              rel="noreferrer"
              className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/40"
            >
              View the source
            </a>
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="px-6 pb-24 md:pb-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-colors duration-200 hover:border-border md:p-7">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
                <FolderOpen
                  className="h-4 w-4 text-foreground/80"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="mb-2 text-[15px] font-semibold tracking-tight">
                Files, yours
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Every note is a plain markdown file. Open it in any editor, move
                it with any tool, keep it forever.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-colors duration-200 hover:border-border md:p-7">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
                <Sparkles
                  className="h-4 w-4 text-foreground/80"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="mb-2 text-[15px] font-semibold tracking-tight">
                AI, yours
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Bring your own model and your own keys. Assistance when you ask
                for it — silence when you don&apos;t.
              </p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-colors duration-200 hover:border-border md:p-7">
              <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-muted/60">
                <Palette
                  className="h-4 w-4 text-foreground/80"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="mb-2 text-[15px] font-semibold tracking-tight">
                Aesthetic, yours
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Serif or sans, wide or narrow, light or dark. A writing surface
                tuned until it disappears.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open source note */}
      <section className="px-6 pb-24 md:pb-28">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-5 flex justify-center">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/50">
              <GitFork className="h-4 w-4 text-foreground/80" />
            </span>
          </div>
          <h2 className="mb-3 text-xl font-semibold tracking-tight md:text-2xl">
            Open source, honestly
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm leading-relaxed text-muted-foreground">
            OpenNotes is Apache 2.0. Read the code, file an issue, fork the
            whole thing — it belongs to everyone.
          </p>
          <a
            href="https://github.com/harshmathurx/OpenNotes"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground/50"
          >
            github.com/harshmathurx/OpenNotes
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            OpenNotes — open source, Apache 2.0
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-foreground">
              App
            </Link>
            <a
              href="https://github.com/harshmathurx/OpenNotes/releases"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Download for Mac
            </a>
            <a
              href="https://github.com/harshmathurx/OpenNotes"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
