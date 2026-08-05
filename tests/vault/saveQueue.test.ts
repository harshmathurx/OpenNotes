import { afterEach, describe, expect, it, vi } from "vitest"
import { SaveQueue } from "@/core/vault/saveQueue"

/**
 * Fake-timer proof of the write-coalescing contract: N rapid saves collapse
 * into O(1) persistence calls carrying the LATEST content; flush forces a
 * pending write to land synchronously; nothing is ever silently dropped.
 */

function makeQueue(debounceMs = 400) {
  const writes: Array<{ path: string; content: string }> = []
  const persist = vi.fn(async (path: string, content: string) => {
    writes.push({ path, content })
  })
  const queue = new SaveQueue(persist, { debounceMs })
  return { queue, persist, writes }
}

afterEach(async () => {
  // Fake timers only fake setTimeout/setInterval — Date.now stays real, so
  // any stray trailing-edge timer would fire during the NEXT fake-timer test
  // (which then looks idle-by-clock and writes immediately). Drain timers
  // while fake timers are still installed so nothing leaks across tests.
  await vi.advanceTimersByTimeAsync(60_000).catch(() => {})
  vi.useRealTimers()
})

describe("SaveQueue coalescing", () => {
  it("20 rapid saves to one path → exactly 1 persistence call with the latest content", async () => {
    vi.useFakeTimers()
    try {
      const { queue, persist, writes } = makeQueue()

      for (let i = 0; i < 20; i++) {
        void queue.save("note.md", `v${i}`, undefined)
      }

      // Leading edge: the first save fires immediately…
      expect(persist).toHaveBeenCalledTimes(1)
      expect(writes[0]).toEqual({ path: "note.md", content: "v0" })

      // …the other 19 coalesce into ONE trailing write carrying v19.
      await vi.advanceTimersByTimeAsync(400)
      expect(persist).toHaveBeenCalledTimes(2)
      expect(writes[1]).toEqual({ path: "note.md", content: "v19" })

      // Settling into idle: nothing more pending.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(persist).toHaveBeenCalledTimes(2)
      expect(queue.isPending("note.md")).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("rapid saves within the window after a completed write coalesce again (latest wins)", async () => {
    vi.useFakeTimers()
    try {
      const { queue, persist, writes } = makeQueue()

      void queue.save("note.md", "a", undefined)
      await vi.advanceTimersByTimeAsync(0)
      expect(writes).toEqual([{ path: "note.md", content: "a" }])

      // Still inside the debounce window → these never fire individually.
      void queue.save("note.md", "b", undefined)
      vi.advanceTimersByTime(100)
      void queue.save("note.md", "c", undefined)
      vi.advanceTimersByTime(100)
      void queue.save("note.md", "d", undefined)

      await vi.advanceTimersByTimeAsync(400)
      expect(persist).toHaveBeenCalledTimes(2)
      expect(writes[1]).toEqual({ path: "note.md", content: "d" })
    } finally {
      vi.useRealTimers()
    }
  })

  it("queues per path independently — interleaved notes each persist their own latest", async () => {
    vi.useFakeTimers()
    try {
      const { queue, writes } = makeQueue()

      void queue.save("a.md", "a1", undefined)
      void queue.save("b.md", "b1", undefined)
      void queue.save("a.md", "a2", undefined)
      void queue.save("b.md", "b2", undefined)

      await vi.advanceTimersByTimeAsync(400)

      const forA = writes.filter((w) => w.path === "a.md")
      const forB = writes.filter((w) => w.path === "b.md")
      expect(forA).toEqual([
        { path: "a.md", content: "a1" },
        { path: "a.md", content: "a2" },
      ])
      expect(forB).toEqual([
        { path: "b.md", content: "b1" },
        { path: "b.md", content: "b2" },
      ])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("SaveQueue flush", () => {
  it("flush(path) persists pending content synchronously without waiting for the window", async () => {
    vi.useFakeTimers()
    try {
      const { queue, persist, writes } = makeQueue()

      void queue.save("note.md", "first", undefined)
      await vi.advanceTimersByTimeAsync(0)
      void queue.save("note.md", "pending", undefined)
      expect(persist).toHaveBeenCalledTimes(1)

      // Cmd+S / note-switch: land it NOW, inside the debounce window.
      await queue.flush("note.md")

      expect(persist).toHaveBeenCalledTimes(2)
      expect(writes[1]).toEqual({ path: "note.md", content: "pending" })
      expect(queue.isPending("note.md")).toBe(false)

      // The cancelled trailing timer must not write again.
      await vi.advanceTimersByTimeAsync(10_000)
      expect(persist).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it("flush on an unknown path is a no-op", async () => {
    const { queue, persist } = makeQueue()
    await queue.flush("never-saved.md")
    expect(persist).not.toHaveBeenCalled()
  })

  it("flushAll persists every path's pending write (note-switch / unmount safety)", async () => {
    vi.useFakeTimers()
    try {
      const { queue, writes } = makeQueue()

      void queue.save("a.md", "a-latest", undefined)
      void queue.save("b.md", "b-latest", undefined)
      void queue.save("a.md", "a-newer", undefined)

      await queue.flushAll()

      expect(writes).toContainEqual({ path: "a.md", content: "a-newer" })
      expect(writes).toContainEqual({ path: "b.md", content: "b-latest" })
      expect(queue.isPending("a.md")).toBe(false)
      expect(queue.isPending("b.md")).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it("flush waits for an in-flight write before persisting the queued latest", async () => {
    vi.useFakeTimers()
    try {
      let release!: () => void
      const gate = new Promise<void>((res) => {
        release = res
      })
      const writes: string[] = []
      const queue = new SaveQueue(
        async (_path: string, content: string) => {
          await gate
          writes.push(content)
        },
        { debounceMs: 400 }
      )

      void queue.save("note.md", "slow-first", undefined)
      await vi.advanceTimersByTimeAsync(0) // leading write starts, blocks on gate
      void queue.save("note.md", "queued-latest", undefined)

      const flushing = queue.flush("note.md")
      release()
      await flushing
      await vi.advanceTimersByTimeAsync(0)

      // The queued save survived the in-flight write and landed with the
      // latest content — order preserved, nothing lost.
      expect(writes).toEqual(["slow-first", "queued-latest"])
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("SaveQueue durability", () => {
  it("resolves every coalesced save's promise once the batch lands", async () => {
    vi.useFakeTimers()
    try {
      const { queue } = makeQueue()
      const resolutions: string[] = []

      for (let i = 0; i < 5; i++) {
        void queue.save("note.md", `v${i}`, undefined).then(() => resolutions.push(`v${i}`))
      }
      await vi.advanceTimersByTimeAsync(400)

      expect(resolutions.sort()).toEqual(["v0", "v1", "v2", "v3", "v4"])
    } finally {
      vi.useRealTimers()
    }
  })

  it("a failing persist rejects the batch and later saves still work", async () => {
    let shouldFail = true
    const queue = new SaveQueue(async () => {
      if (shouldFail) throw new Error("disk full")
    })

    await expect(queue.save("note.md", "x", undefined)).rejects.toThrow(
      "disk full"
    )

    shouldFail = false
    await queue.save("note.md", "retry", undefined)
    expect(queue.isPending("note.md")).toBe(false)
  })

  it("saves arriving during an in-flight write land on the trailing edge", async () => {
    vi.useFakeTimers()
    try {
      const writes: string[] = []
      let resolveWrite!: () => void
      let gated = true
      const queue = new SaveQueue(
        async (_path: string, content: string) => {
          if (gated) await new Promise<void>((res) => (resolveWrite = res))
          writes.push(content)
        },
        { debounceMs: 400 }
      )

      void queue.save("note.md", "v1", undefined)
      await vi.advanceTimersByTimeAsync(0)
      // Write in flight; these must NOT start a second concurrent write.
      void queue.save("note.md", "v2", undefined)
      void queue.save("note.md", "v3", undefined)

      gated = false
      resolveWrite()
      await vi.advanceTimersByTimeAsync(0)
      expect(writes).toEqual(["v1"])

      await vi.advanceTimersByTimeAsync(400)
      expect(writes).toEqual(["v1", "v3"])
    } finally {
      vi.useRealTimers()
    }
  })
})
