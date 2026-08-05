export type AIProvider = "anthropic" | "openai" | "ollama"

export interface StreamOptions {
  provider: AIProvider
  apiKey: string
  ollamaUrl?: string
  model?: string
  prompt: string
  systemPrompt?: string
  onChunk: (chunk: string) => void
  onError: (error: string) => void
  onDone: () => void
  signal?: AbortSignal
}

/**
 * Structured error handed to `onError`. The serialized format is
 * `CODE::human message` so simple consumers can keep treating the callback
 * payload as a plain string, while the panel can recover the stable code.
 */
export class AIStreamError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = "AIStreamError"
    this.code = code
  }
}

/** Stable error codes the UI can map to human-first copy. */
export const AI_ERROR_CODES = {
  MISSING_KEY: "MISSING_KEY",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  NOT_FOUND: "NOT_FOUND",
  OVERLOADED: "OVERLOADED",
  NETWORK: "NETWORK",
  HTTP: "HTTP",
  NO_READER: "NO_READER",
  UNKNOWN: "UNKNOWN",
} as const

export function serializeAIError(code: string, message: string): string {
  return `${code}::${message}`
}

export function parseAIErrorCode(error: string): string | null {
  const idx = error.indexOf("::")
  if (idx <= 0) return null
  return error.slice(0, idx)
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o",
  ollama: "llama3.1",
}

/**
 * Parse a single raw stream line into a text chunk.
 *
 * - Anthropic / OpenAI speak SSE: `data: {json}` lines, terminated by
 *   `data: [DONE]`.
 * - Ollama speaks newline-delimited JSON: `{"response":"...","done":false}`.
 *
 * Returns the decoded text, or `null` when the line carries no user-visible
 * text (heartbeats, metadata frames, `[DONE]`, malformed JSON, blanks).
 * This function is intentionally pure so it can be unit tested.
 */
export function parseProviderChunk(provider: AIProvider, line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  if (provider === "anthropic") {
    if (!trimmed.startsWith("data:")) return null
    const dataStr = trimmed.slice(5).trim()
    if (!dataStr || dataStr === "[DONE]") return null
    try {
      const data = JSON.parse(dataStr)
      if (data.type === "content_block_delta" && typeof data.delta?.text === "string") {
        return data.delta.text
      }
      return null
    } catch {
      return null
    }
  }

  if (provider === "openai") {
    if (!trimmed.startsWith("data:")) return null
    const dataStr = trimmed.slice(5).trim()
    if (!dataStr || dataStr === "[DONE]") return null
    try {
      const data = JSON.parse(dataStr)
      const content = data.choices?.[0]?.delta?.content
      return typeof content === "string" && content.length > 0 ? content : null
    } catch {
      return null
    }
  }

  // ollama
  try {
    const data = JSON.parse(trimmed)
    return typeof data.response === "string" && data.response.length > 0
      ? data.response
      : null
  } catch {
    return null
  }
}

export async function streamAICoWriter({
  provider,
  apiKey,
  ollamaUrl = "http://localhost:11434",
  model,
  prompt,
  systemPrompt = "You are an expert co-writer. Continue or improve the user's note. Return ONLY the relevant text to insert directly in the note. Keep formatting neat in markdown. Do NOT write conversational intros or wraps.",
  onChunk,
  onError,
  onDone,
  signal,
}: StreamOptions) {
  const fail = (code: string, message: string) => {
    onError(serializeAIError(code, message))
  }

  try {
    if (provider !== "ollama" && !apiKey) {
      fail(
        AI_ERROR_CODES.MISSING_KEY,
        "API key is missing. Add it in AI settings before using the Co-Writer."
      )
      return
    }

    const resolvedModel = model || DEFAULT_MODELS[provider]

    let url = ""
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    let body: Record<string, unknown> = {}

    if (provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages"
      headers["x-api-key"] = apiKey
      headers["anthropic-version"] = "2023-06-01"
      headers["anthropic-dangerously-allow-browser"] = "true"

      body = {
        model: resolvedModel,
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
        stream: true,
      }
    } else if (provider === "openai") {
      url = "https://api.openai.com/v1/chat/completions"
      headers["Authorization"] = `Bearer ${apiKey}`

      body = {
        model: resolvedModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        stream: true,
      }
    } else {
      url = `${ollamaUrl.replace(/\/$/, "")}/api/generate`
      body = {
        model: resolvedModel,
        prompt: `${systemPrompt}\n\nUser text:\n${prompt}`,
        stream: true,
      }
    }

    let response: Response
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal,
      })
    } catch (fetchError: unknown) {
      if (fetchError instanceof Error && fetchError.name === "AbortError") throw fetchError
      // TypeError: Failed to fetch -> offline, DNS, CORS, or unreachable host.
      fail(
        AI_ERROR_CODES.NETWORK,
        fetchError instanceof Error ? fetchError.message : "Network request failed"
      )
      return
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "")
      let detail = ""
      try {
        const parsed = JSON.parse(errorText)
        const raw = parsed.error?.message ?? parsed.error ?? parsed.message
        detail = typeof raw === "string" ? raw : JSON.stringify(raw)
      } catch {
        detail = errorText.slice(0, 500)
      }

      const status = response.status
      const suffix = detail ? ` — ${detail}` : ""
      if (status === 401) {
        fail(AI_ERROR_CODES.UNAUTHORIZED, `HTTP 401${suffix}`)
      } else if (status === 403) {
        fail(AI_ERROR_CODES.FORBIDDEN, `HTTP 403${suffix}`)
      } else if (status === 404) {
        fail(AI_ERROR_CODES.NOT_FOUND, `HTTP 404${suffix}`)
      } else if (status === 429) {
        fail(AI_ERROR_CODES.RATE_LIMITED, `HTTP 429${suffix}`)
      } else if (status === 529 || status === 503) {
        fail(AI_ERROR_CODES.OVERLOADED, `HTTP ${status}${suffix}`)
      } else {
        fail(AI_ERROR_CODES.HTTP, `HTTP ${status}${suffix}`)
      }
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      fail(AI_ERROR_CODES.NO_READER, "Response body reader not available")
      return
    }

    const decoder = new TextDecoder()
    let buffer = ""

    const flushLine = (line: string) => {
      const text = parseProviderChunk(provider, line)
      if (text) onChunk(text)
    }

    // Stop cleanly: check the signal between reads so an abort mid-stream
    // cancels the reader instead of dribbling more chunks into the UI.
    while (!signal?.aborted) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split("\n")
      buffer = lines.pop() || ""

      for (const line of lines) flushLine(line)
    }

    if (signal?.aborted) {
      await reader.cancel().catch(() => {})
      return
    }

    // Process leftover buffer (covers streams that end without a trailing \n).
    if (buffer) flushLine(buffer)

    onDone()
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      // Clean stop requested by the user — not an error, stay silent.
      return
    }
    fail(
      AI_ERROR_CODES.UNKNOWN,
      error instanceof Error ? error.message : "An unexpected error occurred."
    )
  }
}
