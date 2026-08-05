/**
 * OnboardingFlow unit tests — screen-by-screen behavior per docs/onboarding.md.
 *
 * The flow owns no persistence: these tests assert it only calls the host's
 * callbacks at the moments the spec defines, that a cancelled folder picker
 * is a silent no-op (spec 5.3), and that web users see the honest Mac-app
 * note instead of a hard block (spec 5.4).
 */

import "@testing-library/jest-dom/vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { OnboardingFlow, type OnboardingFlowProps } from "@/components/onboarding/OnboardingFlow"
import { ONBOARDING_COPY as C } from "@/components/onboarding/copy"

const PICKED = "/Users/harsh/Notes"

function makeProps(
  overrides: Partial<OnboardingFlowProps> = {}
): OnboardingFlowProps & {
  onStartWriting: ReturnType<typeof vi.fn>
  onFolderChosen: ReturnType<typeof vi.fn>
  pickNotesFolder: ReturnType<typeof vi.fn>
} {
  const props = {
    onStartWriting: vi.fn(),
    onFolderChosen: vi.fn(),
    isDesktop: true,
    pickNotesFolder: vi.fn<() => Promise<string | null>>(),
    ...overrides,
  }
  return props as OnboardingFlowProps & {
    onStartWriting: ReturnType<typeof vi.fn>
    onFolderChosen: ReturnType<typeof vi.fn>
    pickNotesFolder: ReturnType<typeof vi.fn>
  }
}

/** Screen 0 → Screen 1 via the secondary door. */
function advanceToChoose() {
  fireEvent.click(
    screen.getByRole("button", { name: C.welcome.secondary })
  )
}

describe("OnboardingFlow — Screen 0 (Welcome)", () => {
  it("renders the headline and both doors", () => {
    render(<OnboardingFlow {...makeProps()} />)

    expect(
      screen.getByRole("heading", { name: C.welcome.headline })
    ).toBeInTheDocument()
    expect(screen.getByText(C.welcome.subline)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: C.welcome.primary })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: C.welcome.secondary })
    ).toBeInTheDocument()
    expect(screen.getByText(C.welcome.caption)).toBeInTheDocument()
  })

  it('"Start writing" calls onStartWriting immediately (the skip)', () => {
    const props = makeProps()
    render(<OnboardingFlow {...props} />)

    fireEvent.click(screen.getByRole("button", { name: C.welcome.primary }))
    expect(props.onStartWriting).toHaveBeenCalledTimes(1)
    expect(props.onFolderChosen).not.toHaveBeenCalled()
  })

  it('"Set up how you work" advances to the choose screen', () => {
    render(<OnboardingFlow {...makeProps()} />)
    advanceToChoose()

    expect(
      screen.getByRole("heading", { name: C.choose.headline })
    ).toBeInTheDocument()
  })
})

describe("OnboardingFlow — Screen 1 (Choose your setup)", () => {
  it("renders the three cards with local pre-selected", () => {
    render(<OnboardingFlow {...makeProps()} />)
    advanceToChoose()

    const local = screen.getByRole("radio", { name: /Keep it in this browser/ })
    const folder = screen.getByRole("radio", { name: /A folder on this Mac/ })
    const git = screen.getByRole("radio", { name: /A folder with git sync/ })

    expect(local).toHaveAttribute("aria-checked", "true")
    expect(folder).toHaveAttribute("aria-checked", "false")
    expect(git).toHaveAttribute("aria-checked", "false")
    expect(screen.getByText(C.choose.cards.local.body)).toBeInTheDocument()
    expect(screen.getByText(C.choose.cards.folder.body)).toBeInTheDocument()
    expect(screen.getByText(C.choose.cards.git.body)).toBeInTheDocument()
    expect(screen.getAllByText("Mac app")).toHaveLength(2)
    expect(screen.getByText(C.choose.reassurance)).toBeInTheDocument()
  })

  it("Continue with local goes to the local confirm screen", () => {
    render(<OnboardingFlow {...makeProps()} />)
    advanceToChoose()

    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))
    expect(
      screen.getByRole("heading", { name: C.configLocal.headline })
    ).toBeInTheDocument()
  })

  it("cards are keyboard selectable (arrow keys move selection)", () => {
    render(<OnboardingFlow {...makeProps()} />)
    advanceToChoose()

    const local = screen.getByRole("radio", { name: /Keep it in this browser/ })
    fireEvent.keyDown(local, { key: "ArrowDown" })

    const folder = screen.getByRole("radio", { name: /A folder on this Mac/ })
    expect(folder).toHaveAttribute("aria-checked", "true")
    expect(folder).toHaveFocus()
  })
})

describe("OnboardingFlow — Screen 2a (local confirm)", () => {
  it('"Start writing" calls onStartWriting', () => {
    const props = makeProps()
    render(<OnboardingFlow {...props} />)
    advanceToChoose()
    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))

    fireEvent.click(
      screen.getByRole("button", { name: C.configLocal.primary })
    )
    expect(props.onStartWriting).toHaveBeenCalledTimes(1)
    expect(props.onFolderChosen).not.toHaveBeenCalled()
  })
})

describe("OnboardingFlow — Screen 2b (folder)", () => {
  function advanceToFolderConfig() {
    advanceToChoose()
    fireEvent.click(screen.getByRole("radio", { name: /A folder on this Mac/ }))
    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))
    expect(
      screen.getByRole("heading", { name: C.configFolder.headline })
    ).toBeInTheDocument()
  }

  it('"Choose a folder" calls pickNotesFolder and shows the picked path', async () => {
    const props = makeProps()
    props.pickNotesFolder.mockResolvedValue(PICKED)
    render(<OnboardingFlow {...props} />)
    advanceToFolderConfig()

    fireEvent.click(
      screen.getByRole("button", { name: C.configFolder.pick })
    )
    expect(props.pickNotesFolder).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByText(PICKED)).toBeInTheDocument()
    })
    expect(
      screen.getByText(C.configFolder.afterPickLabel)
    ).toBeInTheDocument()
    expect(
      screen.getByText(C.configFolder.afterPickFriendly("Notes"))
    ).toBeInTheDocument()
  })

  it("cancel (null) stays silently on the config screen", async () => {
    const props = makeProps()
    props.pickNotesFolder.mockResolvedValue(null)
    render(<OnboardingFlow {...props} />)
    advanceToFolderConfig()

    fireEvent.click(
      screen.getByRole("button", { name: C.configFolder.pick })
    )
    await waitFor(() => {
      expect(props.pickNotesFolder).toHaveBeenCalledTimes(1)
    })

    // Same screen, still in the pre-pick state, no error UI.
    expect(
      screen.getByRole("heading", { name: C.configFolder.headline })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: C.configFolder.pick })
    ).toBeInTheDocument()
    expect(screen.queryByText(PICKED)).not.toBeInTheDocument()
  })

  it("folder Continue → done screen, whose button calls onFolderChosen", async () => {
    const props = makeProps()
    props.pickNotesFolder.mockResolvedValue(PICKED)
    render(<OnboardingFlow {...props} />)
    advanceToFolderConfig()

    fireEvent.click(
      screen.getByRole("button", { name: C.configFolder.pick })
    )
    await waitFor(() => {
      expect(screen.getByText(PICKED)).toBeInTheDocument()
    })

    fireEvent.click(
      screen.getByRole("button", { name: C.configFolder.continue })
    )
    expect(
      screen.getByRole("heading", { name: C.done.headline })
    ).toBeInTheDocument()
    expect(
      screen.getByText(C.done.pathLine.folder("Notes"))
    ).toBeInTheDocument()
    // The "what you can do now" list + quiet AI pointer.
    for (const item of C.done.items) {
      expect(screen.getByText(item)).toBeInTheDocument()
    }
    expect(screen.getByText(C.done.aiPointer)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: C.done.primaryFolder })
    )
    expect(props.onFolderChosen).toHaveBeenCalledTimes(1)
    expect(props.onStartWriting).not.toHaveBeenCalled()
  })
})

describe("OnboardingFlow — Screen 2c (folder + git)", () => {
  it("shows the no-token explainer and completes via onFolderChosen", async () => {
    const props = makeProps()
    props.pickNotesFolder.mockResolvedValue(PICKED)
    render(<OnboardingFlow {...props} />)
    advanceToChoose()

    fireEvent.click(
      screen.getByRole("radio", { name: /A folder with git sync/ })
    )
    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))

    expect(
      screen.getByRole("heading", { name: C.configGit.headline })
    ).toBeInTheDocument()
    expect(screen.getByText(C.configGit.explainerTitle)).toBeInTheDocument()
    for (const line of C.configGit.explainer) {
      expect(screen.getByText(line)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole("button", { name: C.configGit.pick }))
    await waitFor(() => {
      expect(screen.getByText(PICKED)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole("button", { name: C.configGit.continue }))

    expect(
      screen.getByRole("heading", { name: C.done.headline })
    ).toBeInTheDocument()
    expect(
      screen.getByText(C.done.pathLine.git("Notes"))
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole("button", { name: C.done.primaryFolder })
    )
    expect(props.onFolderChosen).toHaveBeenCalledTimes(1)
  })
})

describe("OnboardingFlow — web (isDesktop=false)", () => {
  it("folder/git cards stay selectable but show the honest Mac-app note", () => {
    const props = makeProps({ isDesktop: false })
    render(<OnboardingFlow {...props} />)
    advanceToChoose()

    // Cards are still present and selectable — hiding them would teach nothing.
    fireEvent.click(screen.getByRole("radio", { name: /A folder on this Mac/ }))
    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))

    // Honest note, still on the choose screen — not a hard block.
    expect(screen.getByText(C.choose.webNote)).toBeInTheDocument()
    expect(screen.getByText(C.choose.webSafeLine)).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: C.choose.headline })
    ).toBeInTheDocument()

    // The user is never stranded: local still works.
    fireEvent.click(
      screen.getByRole("radio", { name: /Keep it in this browser/ })
    )
    fireEvent.click(screen.getByRole("button", { name: C.choose.continue }))
    expect(
      screen.getByRole("heading", { name: C.configLocal.headline })
    ).toBeInTheDocument()
  })
})
