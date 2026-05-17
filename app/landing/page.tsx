export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto max-w-4xl px-6 pt-24 pb-20 text-center">
        <h1 className="mb-4 text-[40px] leading-[1.2] font-semibold tracking-tight text-foreground">
          Your notes. Your storage.
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          A markdown editor that stores your files in GitHub, Dropbox, or just
          your browser. No subscription. No lock-in. No server.
        </p>
        <div className="mb-16 flex justify-center gap-4">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Try it now
          </a>
        </div>

        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="grid grid-cols-3 gap-12">
            <div className="text-center">
              <h3 className="mb-2 font-medium text-foreground">GitHub</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Your notes in a private repo. Free version history.
              </p>
            </div>
            <div className="text-center">
              <h3 className="mb-2 font-medium text-foreground">Dropbox</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Syncs everywhere Dropbox does. No new accounts.
              </p>
            </div>
            <div className="text-center">
              <h3 className="mb-2 font-medium text-foreground">
                Just this browser
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                No account needed. Connect storage later.
              </p>
            </div>
          </div>
        </section>
      </header>
    </div>
  )
}
