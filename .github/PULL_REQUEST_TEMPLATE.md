<!-- Thanks for contributing. Keep the change minimal and focused — one concern per PR. -->

## What

<!-- A short description of the change and the problem it solves. Link the issue if one exists. -->

## How

<!-- The approach in a sentence or two. Note anything you deliberately did NOT do. -->

## Validation

Ran and passing:

- [ ] `pnpm exec eslint .`
- [ ] `pnpm exec tsc --noEmit`
- [ ] `pnpm exec vitest run`
- [ ] `pnpm exec next build`

<!-- Add tests for new logic where practical (pure, framework-free functions are easiest). -->

## Checklist

- [ ] Local-first preserved: nothing here uploads notes, requires an account, or adds telemetry.
- [ ] No secrets, tokens, or generated artifacts (`src-tauri/target`, `.next`, `dist`) committed.
- [ ] No emojis in UI or code; terminology is "notes folder" / "workspace".
- [ ] Docs updated if behavior or the extension API changed.
