import {
  HardDrive,
  GitBranch,
  Cloud,
  ArrowRight,
  Shield,
  Zap,
  Lock,
} from "lucide-react"

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative px-6 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Zap className="mr-1.5 h-3 w-3 text-emerald-500" />
            Now in beta — try it free
          </div>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Your notes.
            <br className="sm:hidden" /> Your storage.
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            A markdown editor that stores your files in GitHub, Dropbox, or just
            your browser. No subscription. No lock-in. No server.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Try it now
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
            <a
              href="https://github.com/opennotes/opennotes"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-6 py-3 text-sm font-medium transition-colors hover:bg-muted"
            >
              <GitBranch className="mr-2 h-4 w-4" />
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="h-px bg-border" />
      </div>

      {/* Features */}
      <section className="px-6 py-20 md:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-3">
            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <GitBranch className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                GitHub
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your notes in a private repo. Free version history. Every change
                is a commit.
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Cloud className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Dropbox
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Syncs everywhere Dropbox does. No new accounts needed. Works
                offline.
              </p>
            </div>

            <div className="flex flex-col items-start">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <HardDrive className="h-5 w-5 text-foreground" />
              </div>
              <h3 className="mb-2 text-base font-semibold text-foreground">
                Just this browser
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                No account needed. Files saved in your browser with IndexedDB.
                Connect storage later.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Principles */}
      <section className="bg-muted/30 px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  You own your data
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Files live in your storage, not ours. We never see what you
                  write.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Shield className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  Plain markdown
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Every file is a .md file. No proprietary format. Export
                  anytime.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
                <Zap className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <h4 className="mb-1 text-sm font-medium text-foreground">
                  Works offline
                </h4>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Edit without internet. Changes sync when you are back online.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            OpenNotes — open source, Apache 2.0
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href="/" className="transition-colors hover:text-foreground">
              App
            </a>
            <a
              href="https://github.com/opennotes/opennotes"
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
