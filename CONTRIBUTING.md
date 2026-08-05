# Contributing to OpenNotes

Thanks for your interest. OpenNotes is a calm, open-source, local-first markdown workspace — **your files, your AI, your aesthetic, no account, no server.** We keep the core small and excellent, and we grow capability through extensions.

## The philosophy

- **Local-first, always.** Every keystroke lands locally before anything syncs. Never break this.
- **No custody of secrets.** We never hold a user's token, key, or password. Git sync uses the user's own local git (Mac app); AI uses the user's own key, encrypted on device.
- **Small core, deep extensions.** If a feature isn't universal, it's an extension. See `docs/extensions.md`.
- **Cut the feature, keep the polish.** A smaller thing done beautifully beats a larger thing done roughly.

## Ways to contribute

1. **Build an extension** — the highest-leverage contribution. Read `docs/extensions.md`, copy `extensions/_starter/`, and open a PR. Templates, backlinks, export, Git Sync, and the AI Co-Writer are the reference patterns.
2. **Fix bugs** — reproduce first, add a failing test, fix, keep it minimal.
3. **Improve the core** — editor, storage, sync. These changes face the highest bar; open an issue to discuss before a large PR.
4. **Documentation & design** — clarity and calm are features here.

## Setup

```bash
corepack enable
pnpm install
pnpm dev          # http://localhost:3000
```

## Before you open a PR

```bash
pnpm exec tsc --noEmit     # types clean
pnpm exec eslint .         # lint clean
pnpm exec vitest run       # all tests green
pnpm exec next build       # builds
```

- Add tests for new logic (pure functions are easiest — keep them framework-free).
- Match the existing code style (Prettier + Tailwind, no emojis in UI or code).
- Keep changes minimal and focused; one concern per PR.
- Do not commit secrets, tokens, or large generated artifacts (`src-tauri/target`, `.next`, `dist`).

## Commit style

Short, imperative, scoped where useful: `fix: stabilize panel toggle`, `feat: add backlinks panel`, `docs: extension guide`. No force-pushes to shared branches.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind, be direct, assume good intent. We're building something people trust with their words — act like it.

## License

Apache-2.0. By contributing, you agree your contributions are licensed under the same.
