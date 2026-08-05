# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in OpenNotes, please report it privately — do not open a public issue.

- Use [GitHub private vulnerability reporting](https://github.com/harshmathurx/OpenNotes/security/advisories/new), or
- Open a [security advisory discussion](https://github.com/harshmathurx/OpenNotes/security) if the form is unavailable.

Include: affected version/commit, steps to reproduce, impact, and whether any user data (notes, keys) is at risk. We aim to acknowledge reports within 72 hours and will keep you updated as we investigate and fix.

## Scope notes

OpenNotes is local-first by design, which shapes its threat model:

- **We never custody a secret.** Git sync uses your local git and SSH/agent credentials; AI keys are entered by you and stored encrypted on device (AES-GCM-256 via WebCrypto on web, macOS Keychain in the desktop app). There is no OpenNotes backend, account system, or telemetry pipeline to breach.
- The highest-impact issues for this project are: anything that could exfiltrate note content or keys from a user's device, XSS in the markdown rendering path, unsafe extension execution (the extension API must never allow remote code execution), and mishandling of credentials in the git sync path.

## Supported versions

OpenNotes is pre-1.0. Security fixes are applied to the latest commit on the main branch; keep your checkout or app current.
