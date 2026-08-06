# Release writing

Release notes are for users, contributors, and future maintainers. They are not a build log.

Write the thing a careful maintainer would want to read six months from now: what changed, who it affects, and what to watch for.

## Rules

- Lead with the user-visible change.
- Keep patch releases short.
- Use sections only when they have real content.
- Mention breaking changes, security fixes, migrations, and signing limits near the top.
- Link PRs or issues when they help trace the change.
- Do not publish local paths, Slack context, private notes, or command transcripts.
- Do not make a small release sound large.

## Common shapes

### Focused patch

```md
# OpenNotes vX.Y.Z

One sentence saying what this release fixes.

## Fixed

- Fixed the observable problem. Add the technical route only if it helps users or maintainers.

## Download

- macOS Apple Silicon: `OpenNotes_X.Y.Z_aarch64.dmg`
- SHA-256 checksum: `OpenNotes_X.Y.Z_aarch64.dmg.sha256`

## macOS note

State signing and notarization status plainly.
```

### Larger release

```md
# OpenNotes vX.Y.Z

Short product-level summary.

## Added
## Changed
## Fixed
## Security
## Known issues
## Download
```

Skip empty sections.

## Examples to learn from

- Rust and React keep small patch releases small.
- Electron groups changes by `Features`, `Fixes`, and `Other Changes`, with PR links.
- GitHub CLI leads with security and upgrade urgency when the release contains security fixes.
- Node.js puts notable changes first, then commit-level detail for maintainers.
- Keep a Changelog is right about the big rule: do not dump git logs into release notes.

## Before publishing

Read the draft once with the `humanizer` lens:

- Cut inflated lines like "this release tightens the loop" if a plain sentence works.
- Remove sermonizing about open source unless the release genuinely needs it.
- Avoid rule-of-three lists, heavy bolding, and generic "why it matters" paragraphs.
- Replace vague value claims with observable behavior.
- Keep the known limitations visible.

A good release note should survive being read by someone who has no idea who built it or what happened in private chat.
