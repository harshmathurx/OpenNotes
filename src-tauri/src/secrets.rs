//! macOS Keychain storage for secrets (e.g. AI API keys) via the `keyring`
//! crate, which uses the native Security.framework backend on macOS.

use keyring::Entry;

/// Keychain service name. Keep stable — changing it orphans existing entries.
const SERVICE: &str = "dev.opennotes.app";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| format!("keychain entry '{key}' unavailable: {e}"))
}

#[tauri::command]
pub fn set_secret(key: String, value: String) -> Result<(), String> {
    entry(&key)?
        .set_password(&value)
        .map_err(|e| format!("failed to store secret '{key}': {e}"))
}

#[tauri::command]
pub fn get_secret(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(value) => Ok(Some(value)),
        // A missing item is not an error — the frontend falls back to its
        // browser storage path when it receives null.
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("failed to read secret '{key}': {e}")),
    }
}

#[tauri::command]
pub fn delete_secret(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) => Ok(()),
        // Deleting something that isn't there is a no-op, not a failure.
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("failed to delete secret '{key}': {e}")),
    }
}
