<!--
Write for maintainers and future contributors. Keep it public, specific, and calm.
This is not an internal status report. No Slack context, no private notes, no "Jeeves did X".
-->

## Summary

<!-- What changed, in one or two sentences. Lead with the user-visible outcome when there is one. -->

## Why

<!-- What problem does this solve? What was awkward, broken, risky, or missing before? -->

## Changes

<!-- Concrete bullets. Keep this factual. -->

-

## Screenshots or demo

<!-- Add screenshots, short clips, or before/after notes for UI changes. Write "N/A" for non-UI changes. -->

## Validation

<!-- Check every command you actually ran. Add or remove lines as needed. -->

- [ ] `pnpm run typecheck`
- [ ] `pnpm run lint`
- [ ] `pnpm exec vitest run`
- [ ] `pnpm run build`
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml`
- [ ] manual app check, if this touches the desktop shell

## Release note

<!-- If this ships to users, write the public-facing line here. If not, write "N/A". -->

>

## Contributor checklist

- [ ] The change preserves OpenNotes' local-first promise: no account, backend, telemetry, or hidden custody of user data.
- [ ] No secrets, tokens, private files, or generated build artifacts are committed.
- [ ] Behavior that can regress has test coverage.
- [ ] Public copy is written for users and contributors, not as an internal handoff note.
- [ ] Docs were updated if behavior, setup, release flow, or the extension API changed.
