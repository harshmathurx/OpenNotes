import { Mark, mergeAttributes } from "@tiptap/core"

export interface WikilinkOptions {
  HTMLAttributes: Record<string, string>
}

export interface WikilinkAttributes {
  path: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikilink: {
      setWikilink: (options: WikilinkAttributes) => ReturnType
      unsetWikilink: () => ReturnType
    }
  }
}

export const Wikilink = Mark.create<WikilinkOptions>({
  name: "wikilink",

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      path: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-path"),
        renderHTML: (attributes) => {
          if (!attributes.path) {
            return {}
          }
          return {
            "data-path": attributes.path,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: "a[data-wikilink]",
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "a",
      mergeAttributes(
        { "data-wikilink": "", class: "wikilink" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      0,
    ]
  },

  addCommands() {
    return {
      setWikilink:
        (attributes) =>
        ({ commands }) => {
          return commands.setMark(this.name, attributes)
        },
      unsetWikilink:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})
