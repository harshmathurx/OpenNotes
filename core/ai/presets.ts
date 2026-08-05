import {
  PenLine,
  List,
  Wand2,
  Briefcase,
  ListTodo,
  Lightbulb,
  type LucideIcon,
} from "lucide-react"

export interface CoWriterPreset {
  /** Stable identifier, also used for analytics-friendly labels. */
  id: string
  label: string
  icon: LucideIcon
  /** Sharp, system-level instruction that defines the transformation. */
  system: string
  /** Whether this preset is a continuation (insert) or a rewrite (replace) when a selection exists. */
  intent: "continue" | "transform"
}

const SHARED_RULES =
  "Return ONLY the resulting text, formatted in clean markdown. " +
  "No preamble, no explanations, no conversational wrap-up, no quotes around the output."

export const CO_WRITER_PRESETS: CoWriterPreset[] = [
  {
    id: "continue",
    label: "Continue writing",
    icon: PenLine,
    intent: "continue",
    system:
      "You are an expert co-writer inside a note-taking app. Seamlessly continue the provided " +
      "text, matching its voice, tense, rhythm, and formatting exactly. Pick up mid-thought if " +
      "needed — never restart or summarize what already exists. Write 1-3 substantive paragraphs. " +
      SHARED_RULES,
  },
  {
    id: "summarize",
    label: "Summarize",
    icon: List,
    intent: "transform",
    system:
      "You are a precise summarizer. Distill the provided text into a tight bulleted list: one " +
      "idea per bullet, no filler, no nested bullets, preserve the key facts and conclusions. " +
      "Keep it under 8 bullets unless the source is long. " +
      SHARED_RULES,
  },
  {
    id: "improve",
    label: "Improve writing",
    icon: Wand2,
    intent: "transform",
    system:
      "You are a world-class editor. Rewrite the provided text to be clearer, tighter, and more " +
      "vivid: cut filler words, fix awkward phrasing, vary sentence length, strengthen verbs. " +
      "Preserve the author's voice, meaning, and all factual content. Keep the same structure " +
      "(headings, lists) unless the structure itself is the problem. " +
      SHARED_RULES,
  },
  {
    id: "professional",
    label: "Make professional",
    icon: Briefcase,
    intent: "transform",
    system:
      "You are a business-writing expert. Rewrite the provided text in a polished, professional " +
      "tone: confident, concise, and courteous. Remove slang, hedging, and casual asides. Keep " +
      "every fact and the original intent intact. " +
      SHARED_RULES,
  },
  {
    id: "todos",
    label: "Extract to-dos",
    icon: ListTodo,
    intent: "transform",
    system:
      "You are an action extractor. Read the provided text and produce a markdown task list of " +
      "concrete next actions. Format every item as an unchecked checkbox: '- [ ] Action'. Start " +
      "each action with a strong verb. Infer owners or dates only when explicitly stated. " +
      "If there are no actionable items, return a single line saying so. " +
      SHARED_RULES,
  },
  {
    id: "brainstorm",
    label: "Brainstorm ideas",
    icon: Lightbulb,
    intent: "transform",
    system:
      "You are a creative thinking partner. Based on the provided text, generate a diverse list " +
      "of 5-8 fresh ideas, angles, or directions as markdown bullets. Range from safe to bold. " +
      "Each bullet is one crisp sentence — specific enough to act on, not generic advice. " +
      SHARED_RULES,
  },
]

/** Build the user-role payload: instruction + the text to work on. */
export function buildPresetPrompt(preset: CoWriterPreset, text: string): string {
  const verb = preset.intent === "continue" ? "Continue this text" : "Apply the transformation to this text"
  return `${verb}:\n\n${text}`
}
