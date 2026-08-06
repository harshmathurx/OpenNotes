# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in OpenNotes, please report it privately. Do not open a public issue.

Use [GitHub private vulnerability reporting](https://github.com/harshmathurx/OpenNotes/security/advisories/new). If that flow is unavailable, contact the maintainer through the profile linked from the repository.

Please include:

- Affected version or commit.
- Surface: Mac app or browser build.
- Steps to reproduce.
- Impact: note disclosure, note loss, credential exposure, code execution, or another category.
- Whether any user data, AI key, git credential, or local file may be at risk.

The maintainer aims to acknowledge valid reports within 72 hours.

## Scope

OpenNotes is local-first, which shapes its threat model:

- OpenNotes has no backend, account system, telemetry pipeline, or hosted note storage.
- Git sync uses the user's local git binary and existing SSH/agent credentials.
- AI keys are supplied by the user and stored on device: AES-GCM-256 via WebCrypto on web, macOS Keychain in the desktop app.
- The extension API must not allow remote code execution, secret access, or unexpected access to notes outside its declared host capabilities.

High-impact reports include:

- Exfiltration of note content or local files.
- Exposure or mishandling of AI keys, git credentials, or Keychain data.
- XSS or unsafe markdown rendering.
- Remote code execution through the extension or registry path.
- Git sync behavior that can corrupt, delete, or push user notes unexpectedly.
- Desktop bridge commands callable from the wrong surface or with unsafe arguments.

## Supported versions

OpenNotes is pre-1.0. Security fixes are applied to the latest commit on `main` and shipped in the next release when a user-facing build is affected. Keep your checkout or app current.

## Public disclosure

Please give the maintainer time to investigate and release a fix before public disclosure. Security advisories will credit reporters unless they prefer to stay anonymous.
