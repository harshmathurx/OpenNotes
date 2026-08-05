import "fake-indexeddb/auto"

/**
 * Node >= 22 shadows jsdom's localStorage with an experimental built-in
 * that is undefined unless --localstorage-file is passed. Provide a plain
 * in-memory Storage shim so tests can exercise localStorage-backed code.
 */
if (typeof localStorage === "undefined") {
  class MemoryStorage implements Storage {
    private data = new Map<string, string>()

    get length(): number {
      return this.data.size
    }

    clear(): void {
      this.data.clear()
    }

    getItem(key: string): string | null {
      const value = this.data.get(String(key))
      return value === undefined ? null : value
    }

    key(index: number): string | null {
      return [...this.data.keys()][index] ?? null
    }

    removeItem(key: string): void {
      this.data.delete(String(key))
    }

    setItem(key: string, value: string): void {
      this.data.set(String(key), String(value))
    }
  }

  const storage = new MemoryStorage()
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    writable: true,
    configurable: true,
  })
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "localStorage", {
      value: storage,
      writable: true,
      configurable: true,
    })
  }
}
