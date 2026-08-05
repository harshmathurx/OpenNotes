"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAISettings } from "@/hooks/useAISettings"
import { streamAICoWriter, parseAIErrorCode, AI_ERROR_CODES, type AIProvider } from "@/core/ai/stream"
import { CO_WRITER_PRESETS, buildPresetPrompt, type CoWriterPreset } from "@/core/ai/presets"
import { cn } from "@/lib/utils"
import {
  Sparkles,
  ArrowUp,
  RotateCcw,
  Check,
  X,
  Loader2,
  BookmarkCheck,
  ChevronDown,
  Copy,
  KeyRound,
  MousePointer2,
  FileText,
  CircleAlert,
} from "lucide-react"

interface CoWriterPanelProps {
  selectionText: string
  editorContextBefore: string
  onInsert: (text: string) => void
  onReplace: (text: string) => void
  onClose: () => void
}

/** Static model catalogue — ids are what we send to the provider API. */
const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-5", label: "Sonnet 4.5" },
    { id: "claude-haiku-4-5", label: "Haiku 4.5" },
  ],
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o mini" },
  ],
  ollama: [
    { id: "llama3.1", label: "Llama 3.1" },
    { id: "qwen2.5", label: "Qwen 2.5" },
  ],
}

const MODEL_STORAGE_KEY = "opennotes-ai-model"

function loadModelPrefs(): Partial<Record<AIProvider, string>> {
  try {
    const raw = localStorage.getItem(MODEL_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === "object" && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function persistModelPref(provider: AIProvider, model: string) {
  try {
    const prefs = loadModelPrefs()
    prefs[provider] = model
    localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // storage unavailable — selection simply won't persist
  }
}

interface HumanError {
  message: string
  detail: string
}

/**
 * The ONE place raw provider/stream failures become human-first copy.
 * Raw detail is preserved for the collapsed <details> disclosure.
 */
function humanizeAIError(raw: string, provider: AIProvider): HumanError {
  const code = parseAIErrorCode(raw)
  const detail = code ? raw.slice(code.length + 2) : raw

  switch (code) {
    case AI_ERROR_CODES.MISSING_KEY:
      return { message: "Add your API key in AI settings to use the Co-Writer.", detail }
    case AI_ERROR_CODES.UNAUTHORIZED:
      return { message: "That API key didn't work. Check it in AI settings.", detail }
    case AI_ERROR_CODES.FORBIDDEN:
      return { message: "Your key doesn't have access to this model. Check your plan or pick another model.", detail }
    case AI_ERROR_CODES.RATE_LIMITED:
      return { message: "Rate limited — wait a moment and retry.", detail }
    case AI_ERROR_CODES.NOT_FOUND:
      return {
        message:
          provider === "ollama"
            ? "Model not found in Ollama. Pull it first, e.g. `ollama pull llama3.1`."
            : "That model isn't available for this key. Try another model.",
        detail,
      }
    case AI_ERROR_CODES.OVERLOADED:
      return { message: "The provider is overloaded right now — retry in a few seconds.", detail }
    case AI_ERROR_CODES.NETWORK: {
      const message =
        provider === "anthropic"
          ? "Couldn't reach Anthropic. Check your connection — browser requests may also be blocked by an extension or CORS policy."
          : provider === "ollama"
            ? "Couldn't reach Ollama. Make sure it's running locally (`ollama serve`)."
            : "Couldn't reach the AI provider. Check your internet connection and retry."
      return { message, detail }
    }
    case AI_ERROR_CODES.NO_READER:
      return { message: "The response couldn't be read in this browser.", detail }
    default:
      return { message: "Something went wrong while generating. Retry, or switch model.", detail: detail || raw }
  }
}

const KBD = "rounded border border-border/60 bg-muted/50 px-1 font-mono text-[9px] text-muted-foreground"

export function CoWriterPanel({
  selectionText,
  editorContextBefore,
  onInsert,
  onReplace,
  onClose,
}: CoWriterPanelProps) {
  const { activeKey, provider, ollamaUrl } = useAISettings()

  const [prompt, setPrompt] = useState("")
  const [streamingText, setStreamingText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<HumanError | null>(null)
  const [done, setDone] = useState(false)
  const [copied, setCopied] = useState(false)

  const [modelByProvider, setModelByProvider] = useState<Partial<Record<AIProvider, string>>>(
    () => loadModelPrefs()
  )

  const modelOptions = PROVIDER_MODELS[provider]
  const selectedModel =
    (modelByProvider[provider] && modelOptions.some((m) => m.id === modelByProvider[provider])
      ? modelByProvider[provider]
      : undefined) ?? modelOptions[0].id

  const handleModelChange = (model: string) => {
    setModelByProvider((prev) => ({ ...prev, [provider]: model }))
    persistModelPref(provider, model)
  }

  // What the last run was made of, so Retry replays it exactly.
  const [lastRequest, setLastRequest] = useState<{ prompt: string; system?: string } | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasSelection = selectionText.trim().length > 0
  const needsKey = provider !== "ollama"
  const keyMissing = needsKey && activeKey === ""

  // Focus the input on open (unless there's nothing to call with).
  useEffect(() => {
    if (!keyMissing) inputRef.current?.focus()
  }, [keyMissing])

  // Smooth auto-scroll of the streaming region as tokens arrive.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
  }, [streamingText])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    }
  }, [])

  const runRequest = useCallback(
    async (request: { prompt: string; system?: string }) => {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller
      setLastRequest(request)

      setLoading(true)
      setError(null)
      setDone(false)
      setCopied(false)
      setStreamingText("")

      await streamAICoWriter({
        provider,
        apiKey: activeKey,
        ollamaUrl,
        model: selectedModel,
        prompt: request.prompt,
        ...(request.system ? { systemPrompt: request.system } : {}),
        onChunk: (chunk) => {
          setStreamingText((prev) => prev + chunk)
        },
        onError: (err) => {
          if (abortControllerRef.current === controller) abortControllerRef.current = null
          setError(humanizeAIError(err, provider))
          setLoading(false)
        },
        onDone: () => {
          if (abortControllerRef.current === controller) abortControllerRef.current = null
          setLoading(false)
          setDone(true)
        },
        signal: controller.signal,
      })
    },
    [provider, activeKey, ollamaUrl, selectedModel]
  )

  const handlePreset = (preset: CoWriterPreset) => {
    if (loading || keyMissing) return
    const text = hasSelection ? selectionText : editorContextBefore
    if (!text.trim()) return
    runRequest({ prompt: buildPresetPrompt(preset, text), system: preset.system })
  }

  const handleCustomPrompt = () => {
    const trimmed = prompt.trim()
    if (!trimmed || loading || keyMissing) return
    const context = hasSelection ? selectionText : editorContextBefore
    runRequest({ prompt: `${trimmed}\n\nContext:\n${context}` })
  }

  const handleRetry = () => {
    if (loading || !lastRequest) return
    runRequest(lastRequest)
  }

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setLoading(false)
  }, [])

  const handleDiscard = useCallback(() => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setStreamingText("")
    setDone(false)
    setError(null)
    setLoading(false)
    inputRef.current?.focus()
  }, [])

  const handleAccept = useCallback(() => {
    if (!done || !streamingText.trim()) return
    if (hasSelection) {
      onReplace(streamingText)
    } else {
      onInsert(streamingText)
    }
    onClose()
  }, [done, streamingText, hasSelection, onReplace, onInsert, onClose])

  const handleCopy = async () => {
    if (!streamingText) return
    try {
      await navigator.clipboard.writeText(streamingText)
    } catch {
      const textarea = document.createElement("textarea")
      textarea.value = streamingText
      textarea.style.position = "fixed"
      textarea.style.opacity = "0"
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
    }
    setCopied(true)
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
  }

  // Escape: stop first while streaming, close otherwise. Cmd+Enter accepts when done.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        e.stopPropagation()
        if (loading) handleStop()
        else onClose()
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && done) {
        e.preventDefault()
        handleAccept()
      }
    }
    document.addEventListener("keydown", onKeyDown, true)
    return () => document.removeEventListener("keydown", onKeyDown, true)
  }, [loading, done, handleStop, handleAccept, onClose])

  const showIdle = !loading && !done && !streamingText
  const acceptLabel = hasSelection ? "Replace" : "Insert"
  const selectedModelLabel = modelOptions.find((m) => m.id === selectedModel)?.label ?? selectedModel

  return (
    <div
      role="dialog"
      aria-label="AI Co-Writer"
      className="fixed bottom-6 right-6 z-50 w-[420px] rounded-xl border border-border/80 bg-background/90 p-4 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-border/60 pb-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-500" />
          <span className="text-sm font-semibold text-foreground">Co-Writer</span>
          <span
            className={cn(
              "ml-1 inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
              hasSelection
                ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-300"
                : "border-border/60 bg-muted/40 text-muted-foreground"
            )}
            title={
              hasSelection
                ? "Actions apply to the selected text"
                : "Actions apply to the note context"
            }
          >
            {hasSelection ? (
              <MousePointer2 className="h-2.5 w-2.5" />
            ) : (
              <FileText className="h-2.5 w-2.5" />
            )}
            {hasSelection ? "Selection" : "Note context"}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Model: ${selectedModelLabel}. Change model`}
              className="flex h-6 items-center gap-0.5 rounded-md border border-border/60 bg-background/50 px-1.5 text-[10px] font-medium text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
            >
              {selectedModelLabel}
              <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[140px]">
              {modelOptions.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => handleModelChange(m.id)}
                  className="justify-between text-xs"
                >
                  {m.label}
                  {m.id === selectedModel && <Check className="h-3 w-3 text-violet-500" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close Co-Writer"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calm no-key empty state */}
      {keyMissing ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-500/10">
            <KeyRound className="h-4 w-4 text-violet-500" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Add your API key in AI settings to use the Co-Writer.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => window.dispatchEvent(new CustomEvent("open-ai-settings"))}
          >
            <KeyRound className="h-3 w-3" />
            Open AI settings
          </Button>
        </div>
      ) : (
        <>
          {/* Idle: prompt input + presets */}
          {showIdle && (
            <div className="space-y-3">
              <div className="relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder={
                    hasSelection
                      ? "Ask AI to rewrite the selection..."
                      : "Ask AI to write, edit or summarize..."
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCustomPrompt()
                  }}
                  className="border-border/80 bg-background/50 pr-10 focus:bg-background"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCustomPrompt}
                  disabled={!prompt.trim()}
                  aria-label="Send prompt"
                  className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2 p-0 hover:bg-muted"
                >
                  <ArrowUp className="h-3.5 w-3.5 text-violet-500" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Presets
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CO_WRITER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handlePreset(preset)}
                      className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/40 px-2 py-1.5 text-left text-xs text-foreground/80 transition-all duration-200 hover:border-violet-500/30 hover:bg-accent hover:text-foreground"
                    >
                      <preset.icon className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <span className="truncate">{preset.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {hasSelection && (
                <div className="truncate rounded-lg border border-border/20 bg-muted/40 p-2 text-[10px] text-muted-foreground">
                  Applying to selection: &quot;{selectionText}&quot;
                </div>
              )}
            </div>
          )}

          {/* Streaming / done */}
          {(loading || streamingText) && (
            <div className="space-y-3">
              <div
                ref={scrollRef}
                aria-live="polite"
                className={cn(
                  "max-h-48 overflow-y-auto rounded-lg border bg-background/40 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text transition-colors duration-500",
                  done ? "border-violet-500/40" : "border-border/60"
                )}
              >
                {streamingText}
                {loading && (
                  <span
                    aria-hidden
                    className="ml-0.5 inline-block h-3 w-[3px] animate-pulse rounded-full bg-violet-500 align-[-1px]"
                  />
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {loading ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin text-violet-500" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <BookmarkCheck className="h-3 w-3 text-emerald-500" />
                      <span>Finished</span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {loading && (
                    <Button size="sm" variant="outline" onClick={handleStop} className="h-7 text-xs">
                      Stop
                    </Button>
                  )}
                  {done && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCopy}
                        aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
                        className={cn(
                          "h-7 w-7 p-0",
                          copied && "text-emerald-500 hover:text-emerald-500"
                        )}
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRetry}
                        aria-label="Retry"
                        className="h-7 w-7 p-0"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleDiscard}
                        aria-label="Discard result"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAccept}
                        className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3 w-3" />
                        {acceptLabel}
                        <kbd className={cn(KBD, "border-white/20 bg-white/10 text-white/80")}>
                          ⌘⏎
                        </kbd>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Human-first inline error with collapsed raw detail */}
          {error && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-600 dark:text-red-400"
            >
              <div className="flex items-start gap-1.5">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="leading-relaxed">{error.message}</p>
                  {error.detail && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer select-none text-[10px] opacity-60 hover:opacity-100">
                        Technical details
                      </summary>
                      <pre className="mt-1 max-h-24 overflow-auto rounded bg-background/60 p-1.5 font-mono text-[10px] whitespace-pre-wrap opacity-80">
                        {error.detail}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
              <div className="mt-2 flex justify-end gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setError(null)}
                  className="h-6 px-2 text-[10px] text-red-600 hover:text-red-700 dark:text-red-400"
                >
                  Dismiss
                </Button>
                {lastRequest && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    className="h-6 gap-1 border-red-500/30 px-2 text-[10px] text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Retry
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Keyboard hints */}
          {showIdle && (
            <div className="mt-3 flex items-center gap-2 text-[9px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <kbd className={KBD}>⏎</kbd> send
              </span>
              <span className="flex items-center gap-1">
                <kbd className={KBD}>esc</kbd> close
              </span>
            </div>
          )}
          {done && (
            <div className="mt-2 flex items-center gap-2 text-[9px] text-muted-foreground/70">
              <span className="flex items-center gap-1">
                <kbd className={KBD}>⌘⏎</kbd> accept
              </span>
              <span className="flex items-center gap-1">
                <kbd className={KBD}>esc</kbd> close
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}
