//! Native filesystem access for the notes folder: real .md files on disk.
//!
//! std::fs only — no shell, no extra crates. Every command maps errors to
//! `String` and never panics; per-entry failures inside a listing are
//! tolerated (skipped) so one unreadable file can't sink the whole scan.
//!
//! Non-UTF8 choice: content is decoded with `String::from_utf8_lossy`
//! (U+FFFD replacement chars) instead of skipping the file. A note with a
//! few bad bytes is still a note the user can see and fix; silently hiding
//! it would look like data loss. Documented here and in `FileEntryDto`.

use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Deepest directory nesting `fs_list_markdown` will descend into
/// (relative to `dir`, depth 1 = direct children of `dir`).
const MAX_DEPTH: usize = 8;

/// Directory names that never contain user notes (exact match).
const SKIP_DIRS: [&str; 3] = ["node_modules", ".git", ".obsidian"];

/// Flat, serializable mirror of the frontend `FileEntry` shape.
/// `path` is relative to the notes dir and always posix-style (`/`
/// separators) so the frontend sees identical strings on every platform.
#[derive(Serialize)]
pub struct FileEntryDto {
    path: String,
    content: String,
    modified_ms: i64,
}

/// Reject path traversal: `rel_path` must be relative and contain no
/// parent (`..`) components, no root/prefix, and — belt-and-braces for
/// cross-platform paths arriving at a Mac app — no backslashes (so a
/// Windows-style `..\..\` can't slip through on any platform).
/// Returns the cleaned posix-style relative path.
fn guard_rel_path(rel_path: &str) -> Result<String, String> {
    if rel_path.is_empty() {
        return Err("path is empty".to_string());
    }
    if rel_path.contains('\\') {
        return Err(format!("path '{rel_path}' must use '/' separators"));
    }
    let path = Path::new(rel_path);
    if path.is_absolute() {
        return Err(format!("path '{rel_path}' must be relative"));
    }
    let mut cleaned: Vec<&str> = Vec::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => {
                let part = part
                    .to_str()
                    .ok_or_else(|| format!("path '{rel_path}' is not valid UTF-8"))?;
                cleaned.push(part);
            }
            // Harmless; `a/./b` is `a/b`.
            Component::CurDir => {}
            Component::ParentDir => {
                return Err(format!("path '{rel_path}' must not contain '..'"));
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(format!("path '{rel_path}' must be relative"));
            }
        }
    }
    if cleaned.is_empty() {
        return Err(format!("path '{rel_path}' does not name a file"));
    }
    Ok(cleaned.join("/"))
}

/// Join `dir` + guarded relative path.
fn resolve(dir: &str, rel_path: &str) -> Result<PathBuf, String> {
    let rel = guard_rel_path(rel_path)?;
    Ok(Path::new(dir).join(rel))
}

/// Filesystem mtime → milliseconds since the Unix epoch. Missing or
/// pre-1970 mtimes map to 0 rather than an error.
fn modified_ms(metadata: &fs::Metadata) -> i64 {
    metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Read a file as lossy UTF-8 (see module docs) and build its DTO.
fn read_entry(abs_path: &Path, rel_path: String) -> Result<FileEntryDto, String> {
    let bytes =
        fs::read(abs_path).map_err(|e| format!("failed to read '{}': {e}", abs_path.display()))?;
    let metadata = fs::metadata(abs_path)
        .map_err(|e| format!("failed to stat '{}': {e}", abs_path.display()))?;
    Ok(FileEntryDto {
        path: rel_path,
        content: String::from_utf8_lossy(&bytes).into_owned(),
        modified_ms: modified_ms(&metadata),
    })
}

/// Lowercased `.md` extension check.
fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

/// True for directory names we never descend into: hidden (`.*`) or
/// well-known non-note directories.
fn skip_dir_name(name: &str) -> bool {
    name.starts_with('.') || SKIP_DIRS.contains(&name)
}

/// Depth-first recursive walk. `rel` is the current directory's path
/// relative to the notes root ("" at the root); `depth` counts directory
/// levels descended so far (0 = reading `dir` itself). Unreadable entries
/// are skipped, never fatal.
fn walk(dir: &Path, rel: &str, depth: usize, out: &mut Vec<FileEntryDto>) {
    if depth >= MAX_DEPTH {
        return;
    }
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let name = match entry.file_name().into_string() {
            Ok(name) => name,
            // Non-UTF8 filename: can't build a stable relative path for
            // the frontend, so skip it.
            Err(_) => continue,
        };
        let path = entry.path();
        let rel_child = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        // file_type doesn't follow symlinks; a symlink to a dir reports
        // !is_dir() && !is_file() and falls through to the skip below,
        // which is what we want (never escape the notes root via links).
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if file_type.is_dir() {
            if !skip_dir_name(&name) {
                walk(&path, &rel_child, depth + 1, out);
            }
        } else if file_type.is_file() && is_markdown(&path) {
            if let Ok(dto) = read_entry(&path, rel_child) {
                out.push(dto);
            }
        }
    }
}

/// Recursively list every `.md` file (case-insensitive) under `dir`,
/// skipping hidden dirs, node_modules, .git and .obsidian, to a maximum
/// depth of 8. Per-entry errors are tolerated; only an unreadable root
/// directory is an error. Results are sorted by relative path.
#[tauri::command]
pub fn fs_list_markdown(dir: String) -> Result<Vec<FileEntryDto>, String> {
    let root = Path::new(&dir);
    if !root.is_dir() {
        return Err(format!("'{dir}' is not a directory"));
    }
    let mut out = Vec::new();
    walk(root, "", 0, &mut out);
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(out)
}

/// Read a single file relative to `dir`. Traversal attempts are rejected.
#[tauri::command]
pub fn fs_read_file(dir: String, rel_path: String) -> Result<FileEntryDto, String> {
    let abs = resolve(&dir, &rel_path)?;
    if !abs.is_file() {
        return Err(format!("'{rel_path}' is not a file"));
    }
    read_entry(&abs, guard_rel_path(&rel_path)?)
}

/// Write `content` to `dir/rel_path`, creating parent directories as
/// needed. Returns the entry with a fresh `modified_ms` read back from
/// disk. Traversal attempts are rejected.
#[tauri::command]
pub fn fs_write_file(dir: String, rel_path: String, content: String) -> Result<FileEntryDto, String> {
    let abs = resolve(&dir, &rel_path)?;
    if let Some(parent) = abs.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create directories for '{rel_path}': {e}"))?;
    }
    fs::write(&abs, content).map_err(|e| format!("failed to write '{rel_path}': {e}"))?;
    read_entry(&abs, guard_rel_path(&rel_path)?)
}

/// Delete `dir/rel_path`. A missing file is a no-op, not an error.
/// Traversal attempts are rejected.
#[tauri::command]
pub fn fs_delete_file(dir: String, rel_path: String) -> Result<(), String> {
    let abs = resolve(&dir, &rel_path)?;
    match fs::remove_file(&abs) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("failed to delete '{rel_path}': {e}")),
    }
}

// Note: there is deliberately no fs_pick_directory command. The existing
// JS picker in core/bridge/dialog.ts (tauri-plugin-dialog) already covers
// it, and core/bridge/fs.ts re-exports it — one picker, one code path.
