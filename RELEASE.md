# Releasing OpenNotes

OpenNotes desktop for macOS is distributed as a DMG through [GitHub Releases](https://github.com/harshmathurx/OpenNotes/releases). Builds are produced by the [`release.yml`](.github/workflows/release.yml) GitHub Actions workflow.

## Downloading OpenNotes

1. Go to the [latest release](https://github.com/harshmathurx/OpenNotes/releases/latest).
2. Download the DMG that matches your Mac:
   - Apple Silicon (M1/M2/M3/M4): `OpenNotes_<version>_aarch64.dmg`
   - Intel: `OpenNotes_<version>_x64.dmg`, when attached for that release

   Not sure which? Apple menu → About This Mac. "Chip" means Apple Silicon; "Processor" usually means Intel.

3. Open the DMG and drag `OpenNotes.app` into Applications.

### Unsigned app first-open warning

OpenNotes is not yet code-signed with an Apple Developer ID certificate or notarized by Apple. On first launch, macOS may say the app is from an unidentified developer or cannot be checked for malicious software.

Use the per-app path:

- Right-click or Control-click `OpenNotes.app` in Applications.
- Click **Open**.
- Click **Open** again in the dialog.

Or try to open it once, let macOS block it, then go to **System Settings → Privacy & Security** and click **Open Anyway** next to the OpenNotes message.

You only need to do this once per installed build. Do not disable Gatekeeper globally (`spctl --master-disable` etc.).

Signed and notarized builds require Apple Developer Program membership, a Developer ID Application certificate, and the `APPLE_*` repository secrets listed in the comment block at the top of [`.github/workflows/release.yml`](.github/workflows/release.yml). Once those exist, enable signing in the workflow.

## Cutting a release

1. Bump the version in both places. They must match:
   - `package.json` → `"version"`
   - `src-tauri/tauri.conf.json` → `"version"`

   The DMG filename and app bundle version come from these values, so a mismatch produces confusing artifacts.

2. Update `CHANGELOG.md`.
3. Commit the bump:
   ```sh
   git commit -am "chore: bump version to 0.2.0"
   ```
4. Tag and push:

   ```sh
   git tag v0.2.0
   git push origin main --tags
   ```

   Pushing a `v*` tag triggers the release workflow. You can also run it manually from **Actions → Release → Run workflow** with a tag such as `v0.2.0`.

5. The workflow builds DMGs and publishes a GitHub Release named `OpenNotes v0.2.0` with assets attached.
6. Watch the run under **Actions → Release**. Cold Rust caches can make this slow.

Releases are normal GitHub releases by default, including `0.x` releases. Mark a release as prerelease only when it is explicitly a preview, beta, or otherwise not meant to be treated as the current download.

## Release checklist

- [ ] Local gates are green: `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run`, `pnpm run build`.
- [ ] Desktop changes pass `cargo check --manifest-path src-tauri/Cargo.toml`.
- [ ] Version is bumped in both `package.json` and `src-tauri/tauri.conf.json`.
- [ ] `CHANGELOG.md` has an entry for the release.
- [ ] Tag is pushed: `git tag vX.Y.Z && git push origin vX.Y.Z`.
- [ ] Release workflow completes successfully.
- [ ] Release page shows the expected DMG assets and checksums.
- [ ] At least one DMG is downloaded back and checksum-verified.
- [ ] A real Mac install/open check passes using the first-open warning flow above, unless the build is signed and notarized.
- [ ] README download copy and asset names still match the release.

## Release notes

Keep release notes short and user-facing. Mention:

- What changed.
- Which DMGs are available.
- Signing/notarization status.
- Any migration, compatibility, or known limitation users need before installing.

Use [docs/release-writing.md](docs/release-writing.md) for the project style.
