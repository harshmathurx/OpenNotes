//! Run the user's local `git` binary directly (VS Code-style git sync).
//!
//! We spawn `git` with `std::process::Command` — never through a shell — so
//! arguments can't be interpolated/injected. Auth is entirely the user's own
//! git config + SSH agent; no tokens pass through this process.

use serde::Serialize;
use std::process::{Command, Stdio};

#[derive(Serialize)]
pub struct GitResult {
    stdout: String,
    stderr: String,
    code: i32,
}

/// Spawn `git <args>` in `cwd`, capture output, and always resolve — a non-zero
/// exit is a valid result (e.g. merge conflicts), never a thrown error.
///
/// Returns `Err(String)` only when git could not be spawned at all
/// (binary missing, cwd invalid, etc.).
#[tauri::command]
pub fn run_git(args: Vec<String>, cwd: String) -> Result<GitResult, String> {
    let output = Command::new("git")
        .args(&args)
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .map_err(|e| format!("failed to spawn git in '{cwd}': {e}"))?;

    Ok(GitResult {
        // Git output isn't guaranteed UTF-8 (filenames); lossy keeps us panic-free.
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        // None when killed by a signal; -1 is an unambiguous sentinel for the UI.
        code: output.status.code().unwrap_or(-1),
    })
}

#[derive(Serialize)]
pub struct GitAvailability {
    available: bool,
    version: Option<String>,
}

/// Probe for git by running `git --version` in a neutral directory.
#[tauri::command]
pub fn git_available() -> GitAvailability {
    let probe = Command::new("git")
        .arg("--version")
        .current_dir(std::env::temp_dir())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output();

    match probe {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout).into_owned();
            // "git version 2.50.1" -> "2.50.1"
            let version = raw.trim().strip_prefix("git version ").map(str::to_string);
            GitAvailability {
                available: true,
                version,
            }
        }
        _ => GitAvailability {
            available: false,
            version: None,
        },
    }
}
