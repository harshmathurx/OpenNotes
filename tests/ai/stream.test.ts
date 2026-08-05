import { describe, expect, it } from "vitest"
import { parseAIErrorCode, parseProviderChunk, serializeAIError } from "@/core/ai/stream"

describe("parseProviderChunk — anthropic (SSE)", () => {
  it("extracts text from a content_block_delta frame", () => {
    const line =
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}'
    expect(parseProviderChunk("anthropic", line)).toBe("Hello")
  })

  it("returns null for [DONE]", () => {
    expect(parseProviderChunk("anthropic", "data: [DONE]")).toBeNull()
  })

  it("returns null for non-text frames (message_start, ping, etc.)", () => {
    expect(
      parseProviderChunk(
        "anthropic",
        'data: {"type":"message_start","message":{"id":"msg_1"}}'
      )
    ).toBeNull()
    expect(parseProviderChunk("anthropic", 'data: {"type":"ping"}')).toBeNull()
    expect(
      parseProviderChunk(
        "anthropic",
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}'
      )
    ).toBeNull()
  })

  it("returns null for malformed JSON", () => {
    expect(parseProviderChunk("anthropic", "data: {not valid json")).toBeNull()
  })

  it("returns null for non-data lines and blanks", () => {
    expect(parseProviderChunk("anthropic", "event: content_block_delta")).toBeNull()
    expect(parseProviderChunk("anthropic", "")).toBeNull()
    expect(parseProviderChunk("anthropic", "   ")).toBeNull()
  })
})

describe("parseProviderChunk — openai (SSE)", () => {
  it("extracts delta content", () => {
    const line =
      'data: {"id":"chatcmpl-1","choices":[{"index":0,"delta":{"content":"world"},"finish_reason":null}]}'
    expect(parseProviderChunk("openai", line)).toBe("world")
  })

  it("returns null for [DONE]", () => {
    expect(parseProviderChunk("openai", "data: [DONE]")).toBeNull()
  })

  it("returns null for role-only and empty-delta frames", () => {
    expect(
      parseProviderChunk("openai", 'data: {"choices":[{"index":0,"delta":{"role":"assistant"}}]}')
    ).toBeNull()
    expect(
      parseProviderChunk("openai", 'data: {"choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}')
    ).toBeNull()
  })

  it("returns null for malformed JSON and non-data lines", () => {
    expect(parseProviderChunk("openai", "data: oops")).toBeNull()
    expect(parseProviderChunk("openai", ": keep-alive")).toBeNull()
    expect(parseProviderChunk("openai", "")).toBeNull()
  })
})

describe("parseProviderChunk — ollama (NDJSON)", () => {
  it("extracts the response field", () => {
    expect(
      parseProviderChunk("ollama", '{"model":"llama3.1","response":"The","done":false}')
    ).toBe("The")
  })

  it("returns null for the final done frame with empty response", () => {
    expect(
      parseProviderChunk("ollama", '{"model":"llama3.1","response":"","done":true}')
    ).toBeNull()
  })

  it("returns null for malformed lines and blanks", () => {
    expect(parseProviderChunk("ollama", "{broken")).toBeNull()
    expect(parseProviderChunk("ollama", "")).toBeNull()
    expect(parseProviderChunk("ollama", "data: not-ollama")).toBeNull()
  })
})

describe("AI error serialization", () => {
  it("round-trips code and message", () => {
    const serialized = serializeAIError("RATE_LIMITED", "HTTP 429 — slow down")
    expect(serialized).toBe("RATE_LIMITED::HTTP 429 — slow down")
    expect(parseAIErrorCode(serialized)).toBe("RATE_LIMITED")
  })

  it("returns null for legacy plain-string errors", () => {
    expect(parseAIErrorCode("Some raw provider error")).toBeNull()
    expect(parseAIErrorCode("::no code")).toBeNull()
  })
})
