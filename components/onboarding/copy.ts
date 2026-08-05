/**
 * Onboarding copy deck — every string here is verbatim from
 * docs/onboarding.md Section 3 ("final, paste-ready"). Do not edit copy
 * without changing the spec first.
 */

export interface SetupCardCopy {
  title: string
  badge: string | null
  body: string
  forLine: string
}

export const ONBOARDING_COPY = {
  welcome: {
    headline: "OpenNotes is a calm place to write, where your notes stay yours.",
    subline: "No account. No server. Everything saves on this device.",
    primary: "Start writing",
    secondary: "Set up how you work",
    caption: "You can change how your notes are stored at any time.",
  },

  choose: {
    headline: "Where should your notes live?",
    subline:
      "Pick what fits today — you can change your mind later, and your notes come with you.",
    cards: {
      local: {
        title: "Keep it in this browser",
        badge: null,
        body: "Your notes are saved privately in this browser, on this device. Works offline, starts instantly.",
        forLine: "The simplest way to begin.",
      },
      folder: {
        title: "A folder on this Mac",
        badge: "Mac app",
        body: "Your notes become real files in a folder you pick — easy to search, back up, and open anywhere.",
        forLine: "For notes you'll keep for years.",
      },
      git: {
        title: "A folder with git sync",
        badge: "Mac app",
        body: "The same folder, plus a full history of every change, synced to a remote you control.",
        forLine: "For writers who already use git.",
      },
    } satisfies Record<string, SetupCardCopy>,
    reassurance:
      "Whichever you choose, your notes stay readable, portable, and yours.",
    continue: "Continue",
    back: "Back",
    // Section 5.4 — shown on web when a folder card is selected + continued.
    webNote: "Folder sync works best in the OpenNotes Mac app",
    webSafeLine: "Your notes are safe in this browser either way.",
  },

  configLocal: {
    headline: "Your notes stay in this browser.",
    body1: "They save as you type and work offline — no sign-in, no setup.",
    body2:
      "One thing to know: clearing this browser's site data clears them. If a note ever becomes precious, move it to a folder from Settings.",
    primary: "Start writing",
    back: "Back",
  },

  configFolder: {
    headline: "Pick a home for your notes.",
    body: "Choose any folder. OpenNotes will keep your notes there as plain files you can open in any editor.",
    pick: "Choose a folder",
    afterPickLabel: "Your notes will live in:",
    afterPickFriendly: (name: string) =>
      `Notes in ${name} are yours — searchable, backable, portable.`,
    continue: "Continue",
    back: "Back",
  },

  configGit: {
    headline: "Pick a folder, then let git watch over it.",
    body: "Choose any folder. Your notes live there as plain files, and git keeps a history of every change.",
    pick: "Choose a folder",
    afterPickLabel: "Your notes will live in:",
    explainerTitle: "How sync works here",
    explainer: [
      "OpenNotes uses the git already on your Mac — the same one your code uses.",
      "It signs in with what you already have. You're never asked for a password or token.",
      "Connect a remote like GitHub later, from the Git Sync panel, whenever you're ready.",
    ],
    continue: "Continue",
    back: "Back",
  },

  done: {
    headline: "You're all set.",
    pathLine: {
      local: "Your notes are saving in this browser, right now.",
      folder: (name: string) => `Your notes are real files in ${name}, right now.`,
      git: (name: string) =>
        `Your notes are real files in ${name}. When you want history and sync, open the Git Sync panel.`,
    },
    items: [
      "Just write — everything saves as you type.",
      "Press Cmd+K for your map — every note and every action lives there.",
      "Make it yours — fonts and layout are in Settings, whenever you want them.",
    ],
    aiPointer:
      "Curious later? The AI Co-Writer is opt-in and runs on your own key — or fully on this Mac. Find it in Settings.",
    primaryLocal: "Start writing",
    primaryFolder: "Open your first note",
  },
} as const
