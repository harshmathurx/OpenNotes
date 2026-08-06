# Contributing to OpenNotes

Thanks for helping. OpenNotes is small on purpose: local-first notes, real files, user-owned sync, opt-in AI, no telemetry.

Good contributions make that promise sharper.

## Before opening a PR

- Keep one concern per PR.
- Prefer small, reviewable changes over sweeping rewrites.
- Add tests for behavior that can regress.
- Do not commit generated build output, private files, tokens, API keys, or screenshots containing note content.
- If a feature needs a server, account, analytics, hosted sync, or token custody, open an issue first.

## Useful contribution lanes

- Bug fixes with a clear reproduction.
- Extension ideas and extension API improvements.
- Reliability work around storage, sync, import/export, and desktop shell behavior.
- Documentation that helps users understand where their data lives.
- UI polish that makes the app calmer without making it louder.

## Project orientation

Start with the map in [docs/architecture.md](docs/architecture.md). The short version:

- `components/` is the app surface.
- `core/` holds editor, vault, git, AI, registry, and bridge logic.
- `extensions/` holds bundled extensions and the starter template.
- `src-tauri/` holds the Mac desktop shell.

Browser-safe code should not call native APIs directly. Use the bridge modules in `core/bridge/*` and handle the browser fallback clearly.

## Local setup

```bash
corepack enable
pnpm install
pnpm dev
```

For the Mac app:

```bash
pnpm tauri:dev
```

## Working on extensions

Extensions are the friendliest contribution path. Use [`extensions/_starter`](extensions/_starter) and read [docs/extensions.md](docs/extensions.md).

A good extension PR usually includes:

- A small manifest and `activate(ctx)` entry point.
- Pure logic in an `engine.ts` or similar module.
- Tests for the logic.
- Honest empty/error states if it adds UI.
- No secret storage, telemetry, unexpected network calls, or remote code execution.

## Validation

Run the checks that match your change. For most PRs:

```bash
pnpm run typecheck
pnpm run lint
pnpm exec vitest run
pnpm run build
```

For desktop/Tauri changes, also run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

For extension-only changes, at minimum run the focused test file plus typecheck and lint for the touched paths.

## Writing the PR

The PR should explain:

1. What changed.
2. Why it matters.
3. How you validated it.
4. Whether it affects local-first behavior, storage, sync, secrets, or the extension API.

Public PRs are not internal status notes. Write for the next contributor who lands here from search six months from now.

## Release notes

If your change ships to users, add a short public-facing release note in the PR. Use [docs/release-writing.md](docs/release-writing.md) for the project style.

## Community

- Use [SUPPORT.md](SUPPORT.md) for help paths.
- Use [SECURITY.md](SECURITY.md) for private vulnerability reports.
- Follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- Maintainer expectations live in [GOVERNANCE.md](GOVERNANCE.md).
