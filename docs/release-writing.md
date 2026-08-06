# Release writing guide

Release notes are the public face of OpenNotes. They should read like a careful maintainer explaining what changed and why it matters, not like an internal build receipt.

## Audience

Write for three people at once:

1. **Users** deciding whether to download the build.
2. **Contributors** trying to understand the product direction.
3. **Future maintainers** scanning history months later.

Internal notes can mention exact commands, Slack context, local paths, and operational detail. Public release notes should not.

## Shape

Use this structure unless the release is tiny:

```md
# OpenNotes vX.Y.Z

One short paragraph about the release in product language.

## Highlights

- User-visible outcome.
- Contributor-visible improvement.
- Integrity or compatibility note, if relevant.

## Why it matters

A few sentences explaining the product or trust reason behind the change.

## Download

- macOS Apple Silicon: `OpenNotes_X.Y.Z_aarch64.dmg`
- Checksum: `OpenNotes_X.Y.Z_aarch64.dmg.sha256`

## macOS signing note

Be honest about signing and notarization. Do not bury Gatekeeper caveats.

## Verification

Short list of the meaningful checks, not a raw terminal diary.
```

## Good release notes sound like

- specific
- calm
- user-facing
- honest about limitations
- proud without sounding inflated
- grounded in product behavior

## Avoid

- internal chat context
- local file paths
- full commit SHAs unless needed for traceability
- “I ran...” / “Jeeves did...”
- long command transcripts
- calling a release a preview unless GitHub marks it as pre-release
- burying macOS signing caveats

## Examples

Good:

> Report a bug now works in the Mac app. The command opens a prefilled GitHub issue in the system browser, so users can send useful reports without hunting through the repository.

Bad:

> Ran cargo check, built the DMG from commit abc123, mounted it locally, and uploaded it after fixing the branch.

Good:

> Open-source software earns trust in small places. A bug-report button that does nothing is exactly the kind of paper cut that makes a project feel unfinished.

Bad:

> Fixed bug report button. CI passed.
