import { describe, expect, it } from "vitest"
import { markdownToTiptapJSON, tiptapJSONToMarkdown } from "@/core/editor/markdown"

function normalizeMarkdown(value: string) {
  return value.trim().replace(/\r\n/g, "\n")
}

describe("markdown serialization", () => {
  it("round-trips headings, lists, links, wikilinks, and code blocks", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Project Notes" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            {
              type: "text",
              text: "docs",
              marks: [
                { type: "link", attrs: { href: "https://example.com/docs" } },
              ],
            },
            { type: "text", text: " and " },
            {
              type: "text",
              text: "Inbox",
              marks: [{ type: "wikilink", attrs: { path: "Inbox" } }],
            },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "one" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "two" }] },
              ],
            },
          ],
        },
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "done" }] },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                { type: "paragraph", content: [{ type: "text", text: "later" }] },
              ],
            },
          ],
        },
        {
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [{ type: "text", text: "const ok = true" }],
        },
      ],
    }

    expect(normalizeMarkdown(tiptapJSONToMarkdown(doc))).toBe(
      normalizeMarkdown(`
## Project Notes

Read [docs](https://example.com/docs) and [[Inbox]]

- one
- two

- [x] done
- [ ] later

\`\`\`ts
const ok = true
\`\`\`
`)
    )
  })

  it("parses markdown task list items into Tiptap taskList nodes", () => {
    const doc = markdownToTiptapJSON("- [x] shipped\n- [ ] polish")

    expect(doc).toMatchObject({
      type: "doc",
      content: [
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: true },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "shipped" }],
                },
              ],
            },
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "polish" }],
                },
              ],
            },
          ],
        },
      ],
    })
  })
})
