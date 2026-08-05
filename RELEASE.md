# Releasing OpenNotes

OpenNotes desktop (macOS) is distributed as a DMG via
[GitHub Releases](https://github.com/harshmathurx/OpenNotes/releases). Builds are
produced by the [`release.yml`](.github/workflows/release.yml) GitHub Actions
workflow — never by hand.

## Download (for users)

1. Go to **https://github.com/harshmathurx/OpenNotes/releases** and open the
   latest release.
2. Download the DMG that matches your Mac:
   - **Apple Silicon** (M1/M2/M3/M4): `OpenNotes_<version>_aarch64.dmg`
   - **Intel**: `OpenNotes_<version>_x64.dmg`

   Not sure which? Apple menu → About This Mac → "Chip" means Apple Silicon,
   "Processor" means Intel.
3. Open the DMG and drag **OpenNotes.app** into **Applications**.

### Unsigned app — first-open warning (read this)

OpenNotes is **not yet code-signed or notarized** with an Apple Developer ID
certificate, so macOS Gatekeeper will say the app is from an "unidentified
developer" (or "cannot be checked for malicious software") the first time you
open it. This is expected — the app is safe to run; it just isn't stamped by
Apple yet.

The safe way to open it:

- **Right-click (or Control-click) `OpenNotes.app` in Applications → Open →
  click Open** in the dialog.
- Or: try to open it once, let it fail, then go to **System Settings →
  Privacy & Security** and click **Open Anyway** next to the OpenNotes message.

You only need to do this once. Do **not** bypass Gatekeeper globally
(`spctl --master-disable` etc.) — the per-app steps above are the correct path.

Signed + notarized builds are planned. What's needed: an Apple Developer
Program membership, a *Developer ID Application* certificate, and the
`APPLE_*` repository secrets listed in the comment block at the top of
[`.github/workflows/release.yml`](.github/workflows/release.yml) — flip
`ENABLE_SIGNING` there once the secrets exist.

## Cutting a release (for maintainers)

1. **Bump the version in both places — they must match:**
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`

   (Both are currently `0.1.0`. The DMG filename and the app bundle version
   come from these, so a mismatch produces a misnamed/ mismarked artifact.)
2. Commit the bump, e.g.:
   ```sh
   git commit -am "chore: bump version to 0.2.0"
   ```
3. **Tag and push:**
   ```sh
   git tag v0.2.0
   git push origin main --tags   # or: git push origin v0.2.0
   ```
   Pushing a `v*` tag triggers the release workflow. You can also run it
   manually: **Actions → Release → Run workflow**, entering the tag
   (e.g. `v0.2.0`).
4. The workflow builds two DMGs in parallel — Apple Silicon on `macos-14`,
   Intel on `macos-13` — then publishes a GitHub Release named
   `OpenNotes v0.2.0` with both DMGs attached and auto-generated notes.
   0.x versions are published as **prereleases** automatically.
5. Watch the run: **Actions → Release**. Total time is roughly 20–40 min on a
   cold Rust cache, much less warm.

## Release checklist

- [ ] Gates green locally and in CI: `pnpm exec tsc --noEmit`,
      `pnpm exec eslint .`, `pnpm exec vitest run`, plus the full build
      (`TAURI_BUILD=1 pnpm build`) and e2e (`pnpm test:e2e`).
- [ ] Version bumped in **both** `package.json` and
      `src-tauri/tauri.conf.json` (identical values).
- [ ] Tag pushed: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- [ ] Workflow run completed; the Release page shows **both** DMGs
      (`aarch64` and `x64`) attached to the release.
- [ ] Downloaded one DMG on a real Mac and confirmed it opens (after the
      unsigned-app steps above).
- [ ] README / landing page download links still match the actual asset
      names — update them if the URL or naming pattern changed.
- [ ] CHANGELOG.md entry for the version (the release notes are
      auto-generated, but the changelog is the curated record).
