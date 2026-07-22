# OpenNotes

OpenNotes is a beta, local-first markdown notebook for calm personal writing. It is built with Next.js and stores notes in your browser today, with remote storage work underway.

## What works now

- Create, edit, rename, and delete markdown notes.
- Local persistence through IndexedDB in the current browser profile.
- A focused editor with markdown formatting, wikilinks, slash commands, command palette, mobile sidebar, and light/dark themes.
- No OpenNotes account or OpenNotes server is required for the local workflow.

## Beta caveats

OpenNotes is not production-ready remote-sync software yet. In this branch:

- GitHub sync is under active development and should not be treated as a working backup or collaboration path.
- Dropbox sync is planned after the GitHub provider is proven end to end.
- Browser-local storage can be cleared by private browsing modes, browser resets, storage pressure, or manual site-data deletion.
- Export/backup and full PWA/offline installability are still roadmap items unless implemented in a later branch.

If your notes are important, keep an independent copy outside OpenNotes.

## Where data lives

Notes are saved as records in the browser's IndexedDB database for this app. The current implementation does not upload note content to an OpenNotes backend. Clearing site data for the app will remove the local vault from that browser profile.

## Roadmap

1. Harden the local-first note workflow and backup/export story.
2. Wire GitHub sync end to end, including authentication, provider selection, sync status, and conflict handling.
3. Add Dropbox only after the provider contract is reliable with GitHub.
4. Revisit PWA/installability once real icon assets and offline behavior are in place.

## Local development

```bash
corepack enable
pnpm install
pnpm dev
```

Then open http://localhost:3000.

## Validation commands

```bash
pnpm exec eslint .
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm exec next build
```

## License

Apache-2.0
