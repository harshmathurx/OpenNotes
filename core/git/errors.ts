/**
 * Error type + stderr → hint mapping for the git engine.
 *
 * VS Code philosophy: surface git's stderr verbatim as the message, and attach
 * a short actionable hint only for the well-known failure modes. Anything we
 * don't recognize comes through with `hint: null` and the raw stderr untouched.
 */

export class GitError extends Error {
  /** Actionable, VS-Code-style hint. Null when we have nothing useful to add. */
  readonly hint: string | null
  /** The exact stderr git produced (same as `message`). */
  readonly stderr: string

  constructor(message: string, hint: string | null = null) {
    super(message)
    this.name = "GitError"
    this.hint = hint
    this.stderr = message
  }
}

const IDENTITY_HINT =
  'Make sure you configure your "user.name" and "user.email" in git. See https://git-scm.com/book/en/v2/Getting-Started-First-Time-Git-Setup.'

const SSH_HINT =
  "Git could not authenticate over SSH. Make sure your SSH key exists, is added to ssh-agent (ssh-add --apple-use-keychain ~/.ssh/id_ed25519), and is uploaded to your git host. See https://docs.github.com/en/authentication/connecting-to-github-with-ssh"

const OFFLINE_HINT =
  "Could not reach the remote host. Check your internet connection and try again."

const NOT_A_REPO_HINT =
  "This folder is not a git repository. Initialize one first (git init)."

const NO_UPSTREAM_HINT =
  "The current branch has no upstream branch. Push with set-upstream to publish it."

const NON_FAST_FORWARD_HINT = "Pull first, then push."

/**
 * Ordered matching rules. First match wins — more specific rules come first.
 * Matching is case-insensitive against the raw stderr.
 */
const STDERR_RULES: ReadonlyArray<{ pattern: RegExp; hint: string }> = [
  {
    pattern: /author identity unknown|please tell me who you are|unable to auto-detect email address|empty ident name/i,
    hint: IDENTITY_HINT,
  },
  {
    pattern: /permission denied \(publickey\)/i,
    hint: SSH_HINT,
  },
  {
    pattern: /could not resolve host|temporary failure in name resolution|network is unreachable|operation timed out|failed to connect to .* (port \d+|after \d+ milliseconds)|connection refused/i,
    hint: OFFLINE_HINT,
  },
  {
    pattern: /not a git repository/i,
    hint: NOT_A_REPO_HINT,
  },
  {
    pattern: /no upstream branch|has no upstream branch|set the remote as upstream/i,
    hint: NO_UPSTREAM_HINT,
  },
  {
    pattern: /non-fast-forward|fetch first|stale info|rejected.*\(fetch first\)/i,
    hint: NON_FAST_FORWARD_HINT,
  },
]

/**
 * Map a git stderr string to a hint. Returns null when nothing matches —
 * callers should then show the raw stderr, exactly like VS Code does.
 */
export function hintForStderr(stderr: string): string | null {
  for (const rule of STDERR_RULES) {
    if (rule.pattern.test(stderr)) return rule.hint
  }
  return null
}

/**
 * Build a GitError from a failed git invocation. Message is stderr verbatim
 * (falling back to stdout, then to the exit code) because git writes useful
 * output to stdout in a few failure paths too.
 */
export function gitErrorFromResult(result: {
  stdout: string
  stderr: string
  code: number
}): GitError {
  const message =
    result.stderr.trim() ||
    result.stdout.trim() ||
    `git exited with code ${result.code}`
  return new GitError(message, hintForStderr(message))
}
