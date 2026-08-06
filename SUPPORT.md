# Support

OpenNotes is early, community-supported software. The fastest way to get help is to file the right kind of GitHub issue with enough detail for someone else to reproduce the problem.

## Where to go

- Bugs: use the [bug report template](https://github.com/harshmathurx/OpenNotes/issues/new?template=bug_report.md).
- Feature requests: use the [feature request template](https://github.com/harshmathurx/OpenNotes/issues/new?template=feature_request.md).
- Extension ideas: use the [extension idea template](https://github.com/harshmathurx/OpenNotes/issues/new?template=extension_idea.md).
- Security issues: do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## Before filing

Please include:

- OpenNotes version.
- Surface: Mac app or browser build.
- macOS version, and browser version if relevant.
- Steps to reproduce.
- Whether any note content, sync state, or secrets may be affected.
- Logs or screenshots, with private note content and keys removed.

## Common Mac install issue

OpenNotes is not yet signed with an Apple Developer ID certificate or notarized by Apple. macOS may warn on first launch.

Use the per-app path: **right-click OpenNotes.app → Open → Open**. Do not disable Gatekeeper globally.

See [RELEASE.md](RELEASE.md) for the full install note.
