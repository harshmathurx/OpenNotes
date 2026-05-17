"use client"

import { useState, useCallback } from "react"
import { LocalProvider } from "@/core/storage/local"
import type { StorageProvider } from "@/core/storage/types"

export function useStorage() {
  const [activeProvider, setActiveProvider] = useState<StorageProvider>(
    new LocalProvider()
  )

  const connectProvider = useCallback((provider: StorageProvider) => {
    setActiveProvider(provider)
    void provider.connect()
  }, [])

  return { activeProvider, connectProvider }
}
