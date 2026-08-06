# Contributing to OpenNotes

Thanks for wanting to help. OpenNotes is small on purpose: local-first notes, real files, user-owned sync, opt-in AI, no telemetry.

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

## Writing the PR

The PR should explain:

1. What changed.
2. Why it matters.
3. How you validated it.
4. Whether it affects local-first behavior, storage, sync, secrets, or the extension API.

Public PRs are not internal status notes. Write for the next contributor who lands here from search six months from now.

## Release notes

If your change ships to users, add a short public-facing release note in the PR. Use `docs/release-writing.md` for the project style.
