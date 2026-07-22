"use client"

import { useCallback, useEffect, useState } from "react"
import { db } from "@/core/db/schema"
import { LocalProvider } from "@/core/storage/local"
import { GitHubProvider } from "@/core/storage/github"
import type { StorageProvider } from "@/core/storage/types"
import { encryptTokens, decryptTokens } from "@/core/crypto/tokens"

export const REMOTE_STORAGE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_REMOTE_STORAGE === "true"

const LOCAL_PROVIDER = new LocalProvider()
const TOKEN_PASSPHRASE_KEY = "opennotes-token-passphrase"

export function isRemoteProviderActive(provider: StorageProvider) {
  return provider.id !== "local" && provider.isConnected()
}

function getOrCreateTokenPassphrase() {
  let passphrase = localStorage.getItem(TOKEN_PASSPHRASE_KEY)
  if (!passphrase) {
    passphrase = crypto.randomUUID()
    localStorage.setItem(TOKEN_PASSPHRASE_KEY, passphrase)
  }
  return passphrase
}

export function useStorage() {
  const [activeProvider, setActiveProvider] =
    useState<StorageProvider>(LOCAL_PROVIDER)
  const [remoteError, setRemoteError] = useState<string | null>(null)

  useEffect(() => {
    if (!REMOTE_STORAGE_ENABLED) return

    let cancelled = false
    async function restoreProvider() {
      const config = await db.providerConfig.get("github")
      const encrypted = await db.tokens.get("github")
      if (!config?.connected || !encrypted) return

      try {
        const token = await decryptTokens(
          encrypted.ciphertext,
          encrypted.iv,
          encrypted.salt,
          getOrCreateTokenPassphrase()
        )
        const provider = new GitHubProvider(
          token,
          String(config.config.owner),
          String(config.config.repo),
          String(config.config.branch ?? "main")
        )
        await provider.connect()
        if (!cancelled) setActiveProvider(provider)
      } catch {
        if (!cancelled) {
          setRemoteError(
            "Remote storage could not reconnect. Connect GitHub again."
          )
          setActiveProvider(LOCAL_PROVIDER)
        }
      }
    }

    void restoreProvider()
    return () => {
      cancelled = true
    }
  }, [])

  const connectProvider = useCallback(async (provider: StorageProvider) => {
    setRemoteError(null)

    if (provider.id !== "local" && !REMOTE_STORAGE_ENABLED) {
      setRemoteError("Remote storage is disabled in this build.")
      return
    }

    await provider.connect()
    setActiveProvider(provider)
  }, [])

  const connectGitHub = useCallback(
    async (owner: string, repo: string, token: string, branch = "main") => {
      if (!REMOTE_STORAGE_ENABLED) {
        setRemoteError("Remote storage is disabled in this build.")
        return
      }

      const provider = new GitHubProvider(token, owner, repo, branch)
      await connectProvider(provider)
      const encrypted = await encryptTokens(token, getOrCreateTokenPassphrase())
      await db.tokens.put({ id: "github", ...encrypted })
      await db.providerConfig.put({
        id: "github",
        connected: true,
        config: { owner, repo, branch },
      })
    },
    [connectProvider]
  )

  const connectLocal = useCallback(async () => {
    await db.providerConfig.put({ id: "local", connected: true, config: {} })
    setActiveProvider(LOCAL_PROVIDER)
  }, [])

  const disconnectRemote = useCallback(async () => {
    await db.providerConfig.clear()
    await db.tokens.clear()
    setActiveProvider(LOCAL_PROVIDER)
  }, [])

  return {
    activeProvider,
    connectProvider,
    connectGitHub,
    connectLocal,
    disconnectRemote,
    remoteEnabled: REMOTE_STORAGE_ENABLED,
    remoteActive: isRemoteProviderActive(activeProvider),
    remoteError,
  }
}
