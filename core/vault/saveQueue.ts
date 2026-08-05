/**
 * Write-coalescing engine for the vault save path.
 *
 * Typing fires a save on every keystroke; persisting each one would mean a
 * full disk write + IndexedDB write (+ the useLiveQuery refire it triggers)
 * per character. The SaveQueue coalesces rapid saves to the same path into
 * ONE persistence call that writes the LATEST content:
 *
 * - Leading edge: the first save after an idle period persists immediately,
 *   so note creation and the first keystroke land without delay.
 * - Trailing edge: saves arriving while a write is in flight (or within the
 *   debounce window of the last completed write) are coalesced — only the
 *   latest content is kept — and flushed once the window elapses.
 *
 * Correctness: flush(path)/flushAll() persist pending writes synchronously
 * and are called on unmount, note-switch, Cmd+S, and before delete/rename,
 * so no content is ever lost. The queue never blocks typing: save() returns
 * a promise that settles when the coalesced write lands, but callers typing
 * in the editor fire-and-forget it.
 */

export interface SaveQueueOptions {
  /** Debounce window in ms for the trailing-edge write. Default 400ms. */
  debounceMs?: number
  /** Injectable clock for tests. */
  now?: () => number
}

type PersistFn<C> = (path: string, content: string, ctx: C) => Promise<void>

interface PendingSave<C> {
  content: string
  ctx: C
  /** Resolves once this save (or a later coalesced one) has been persisted. */
  resolve: () => void
  reject: (err: unknown) => void
}

interface PathEntry<C> {
  timer: ReturnType<typeof setTimeout> | null
  pending: PendingSave<C>[]
  /** Settles when the in-flight persistence for this path completes. */
  inflight: Promise<void> | null
  lastWriteAt: number
}

export class SaveQueue<C = void> {
  private readonly persistFn: PersistFn<C>
  private readonly debounceMs: number
  private readonly now: () => number
  private readonly entries = new Map<string, PathEntry<C>>()

  constructor(persistFn: PersistFn<C>, options: SaveQueueOptions = {}) {
    this.persistFn = persistFn
    this.debounceMs = options.debounceMs ?? 400
    this.now = options.now ?? (() => Date.now())
  }

  /**
   * Queue a save. Coalesces with any other pending save for the same path —
   * latest content (and its context) wins. Resolves once the content (or a
   * later coalesced version of it) has been persisted.
   */
  save(path: string, content: string, ctx: C): Promise<void> {
    const entry = this.getEntry(path)

    // Coalesce into the pending batch for this path: reuse the first pending
    // record (its promise stands in for "this path's pending write") and
    // overwrite content + ctx — latest wins. Later saves in the same batch
    // share that promise so every caller resolves on the single write.
    const head = entry.pending[0]
    if (head) {
      head.content = content
      head.ctx = ctx
      return Promise.resolve()
    }

    let resolve!: () => void
    let reject!: (err: unknown) => void
    const settled = new Promise<void>((res, rej) => {
      resolve = res
      reject = rej
    })
    // Never let an unobserved rejection crash fire-and-forget callers;
    // flush() re-surfaces errors through its own await.
    settled.catch(() => {})
    entry.pending.push({ content, ctx, resolve, reject })

    const sinceLastWrite = this.now() - entry.lastWriteAt
    if (!entry.inflight && sinceLastWrite >= this.debounceMs) {
      // Leading edge: idle → persist right away.
      void this.startWrite(path, entry)
    } else {
      // Within the window (or a write in flight): schedule trailing edge.
      this.armTimer(path, entry, this.debounceMs - sinceLastWrite)
    }
    return settled
  }

  /** Persist any pending save for `path` right now. No-op when clean. */
  async flush(path: string): Promise<void> {
    const entry = this.entries.get(path)
    if (!entry) return
    if (entry.inflight) await entry.inflight
    if (entry.pending.length > 0) {
      await this.startWrite(path, entry)
    }
  }

  /** Persist every pending save across all paths. */
  async flushAll(): Promise<void> {
    await Promise.all([...this.entries.keys()].map((path) => this.flush(path)))
  }

  /** True when `path` has queued-but-not-yet-persisted content. */
  isPending(path: string): boolean {
    const entry = this.entries.get(path)
    return (entry?.pending.length ?? 0) > 0
  }

  private getEntry(path: string): PathEntry<C> {
    let entry = this.entries.get(path)
    if (!entry) {
      entry = {
        timer: null,
        pending: [],
        inflight: null,
        lastWriteAt: 0,
      }
      this.entries.set(path, entry)
    }
    return entry
  }

  private armTimer(path: string, entry: PathEntry<C>, delay: number): void {
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = setTimeout(() => {
      entry.timer = null
      void this.flush(path)
    }, Math.max(0, delay))
  }

  /**
   * Persist the latest pending content for a path exactly once, then re-arm
   * if more saves arrived while the write was in flight.
   */
  private async startWrite(path: string, entry: PathEntry<C>): Promise<void> {
    if (entry.timer) {
      clearTimeout(entry.timer)
      entry.timer = null
    }
    const batch = entry.pending.splice(0, entry.pending.length)
    if (batch.length === 0) return

    const latest = batch[batch.length - 1]
    const write = (async () => {
      try {
        await this.persistFn(path, latest.content, latest.ctx)
        for (const save of batch) save.resolve()
      } catch (err) {
        for (const save of batch) save.reject(err)
        return
      } finally {
        entry.inflight = null
        entry.lastWriteAt = this.now()
      }
      // Saves that arrived during the write wait for the trailing edge —
      // never fire a second write synchronously back-to-back.
      if (entry.pending.length > 0) {
        const delay = this.debounceMs - (this.now() - entry.lastWriteAt)
        this.armTimer(path, entry, delay)
      }
    })()

    entry.inflight = write
    await write
  }
}
