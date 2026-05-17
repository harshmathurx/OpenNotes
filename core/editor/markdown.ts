import { marked } from "marked"

// ── Markdown → Tiptap JSON ──

export function markdownToTiptapJSON(
  markdown: string
): Record<string, unknown> {
  const tokens = marked.lexer(markdown)
  return {
    type: "doc",
    content: tokensToNodes(tokens),
  }
}

function tokensToNodes(
  tokens: ReturnType<typeof marked.lexer>
): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = []

  for (const token of tokens) {
    const node = tokenToNode(token as Record<string, unknown>)
    if (node) result.push(node)
  }

  return result
}

function tokenToNode(
  token: Record<string, unknown>
): Record<string, unknown> | null {
  const type = token.type as string

  switch (type) {
    case "paragraph":
      return {
        type: "paragraph",
        content: inlineTokensToNodes(
          token.tokens as Array<Record<string, unknown>> | undefined
        ),
      }

    case "heading":
      return {
        type: "heading",
        attrs: { level: token.depth as number },
        content: inlineTokensToNodes(
          token.tokens as Array<Record<string, unknown>> | undefined
        ),
      }

    case "list": {
      const listType = (token.ordered as boolean) ? "orderedList" : "bulletList"
      const items = token.items as Array<Record<string, unknown>>
      return {
        type: listType,
        content: items.map((item) => ({
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: inlineTokensToNodes(
                item.tokens as Array<Record<string, unknown>> | undefined
              ),
            },
          ],
        })),
      }
    }

    case "code":
      return {
        type: "codeBlock",
        attrs: { language: (token.lang as string) || "" },
        content: [{ type: "text", text: token.text as string }],
      }

    case "blockquote":
      return {
        type: "blockquote",
        content: tokensToNodes(token.tokens as ReturnType<typeof marked.lexer>),
      }

    case "hr":
      return { type: "horizontalRule" }

    case "space":
      return null

    default:
      return null
  }
}

interface TextNode {
  type: "text"
  text: string
  marks?: Array<Record<string, unknown>>
}

function inlineTokensToNodes(
  tokens: Array<Record<string, unknown>> | undefined
): TextNode[] {
  if (!tokens) return []

  const result: TextNode[] = []

  for (const token of tokens) {
    const type = token.type as string

    switch (type) {
      case "text":
        result.push({ type: "text", text: token.text as string })
        break

      case "strong": {
        const inner = inlineTokensToNodes(
          token.tokens as Array<Record<string, unknown>> | undefined
        )
        for (const n of inner) {
          result.push({
            type: "text",
            text: n.text,
            marks: [...(n.marks || []), { type: "bold" }],
          })
        }
        break
      }

      case "em": {
        const inner = inlineTokensToNodes(
          token.tokens as Array<Record<string, unknown>> | undefined
        )
        for (const n of inner) {
          result.push({
            type: "text",
            text: n.text,
            marks: [...(n.marks || []), { type: "italic" }],
          })
        }
        break
      }

      case "codespan":
        result.push({
          type: "text",
          text: token.text as string,
          marks: [{ type: "code" }],
        })
        break

      case "link":
        result.push({
          type: "text",
          text: token.text as string,
          marks: [
            {
              type: "link",
              attrs: { href: token.href as string, target: "_blank" },
            },
          ],
        })
        break

      case "del":
        result.push({
          type: "text",
          text: token.text as string,
          marks: [{ type: "strike" }],
        })
        break

      case "br":
        result.push({ type: "text", text: "\n" })
        break

      default:
        result.push({ type: "text", text: token.raw as string })
    }
  }

  return result
}

// ── Tiptap JSON → Markdown ──

export function tiptapJSONToMarkdown(doc: Record<string, unknown>): string {
  const content = doc.content as Array<Record<string, unknown>> | undefined
  if (!content) return ""
  return content.map(nodeToMarkdown).filter(Boolean).join("\n\n")
}

function nodeToMarkdown(node: Record<string, unknown>): string {
  const type = node.type as string

  switch (type) {
    case "paragraph":
      return textContent(node.content as TextNode[] | undefined)

    case "heading": {
      const level = (node.attrs as Record<string, number>)?.level || 1
      return (
        "#".repeat(level) +
        " " +
        textContent(node.content as TextNode[] | undefined)
      )
    }

    case "bulletList": {
      const items = node.content as Array<Record<string, unknown>>
      return items
        .map((item) => {
          const para = (item.content as Array<Record<string, unknown>>)?.[0]
          return "- " + textContent(para?.content as TextNode[] | undefined)
        })
        .join("\n")
    }

    case "orderedList": {
      const items = node.content as Array<Record<string, unknown>>
      return items
        .map((item, i) => {
          const para = (item.content as Array<Record<string, unknown>>)?.[0]
          return (
            `${i + 1}. ` + textContent(para?.content as TextNode[] | undefined)
          )
        })
        .join("\n")
    }

    case "taskList": {
      const items = node.content as Array<Record<string, unknown>>
      return items
        .map((item) => {
          const checked = (item.attrs as Record<string, boolean>)?.checked
          const para = (item.content as Array<Record<string, unknown>>)?.[0]
          return (
            "- [" +
            (checked ? "x" : " ") +
            "] " +
            textContent(para?.content as TextNode[] | undefined)
          )
        })
        .join("\n")
    }

    case "codeBlock": {
      const lang = (node.attrs as Record<string, string>)?.language || ""
      const text = textContent(node.content as TextNode[] | undefined)
      return "```" + lang + "\n" + text + "\n```"
    }

    case "blockquote": {
      const inner = (node.content as Array<Record<string, unknown>>)
        .map(nodeToMarkdown)
        .filter(Boolean)
        .join("\n\n")
      return inner
        .split("\n")
        .map((line) => "> " + line)
        .join("\n")
    }

    case "horizontalRule":
      return "---"

    default:
      return ""
  }
}

function textContent(content: TextNode[] | undefined): string {
  if (!content) return ""

  return content
    .map((item) => {
      if (item.type !== "text") return ""

      let text = item.text || ""
      const marks = item.marks || []

      for (const mark of [...marks].reverse()) {
        switch (mark.type) {
          case "bold":
            text = "**" + text + "**"
            break
          case "italic":
            text = "*" + text + "*"
            break
          case "code":
            text = "`" + text + "`"
            break
          case "strike":
            text = "~~" + text + "~~"
            break
          case "link": {
            const href = (mark.attrs as Record<string, string>)?.href || ""
            text = "[" + text + "](" + href + ")"
            break
          }
          case "wikilink": {
            const path = (mark.attrs as Record<string, string>)?.path || text
            text = "[[" + path + "]]"
            break
          }
        }
      }

      return text
    })
    .join("")
}
