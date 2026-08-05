use std::process::Command;

#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|_| "Invalid URL".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https URLs can be opened externally".to_string());
    }

    match parsed.host_str() {
        Some("github.com") => {}
        _ => return Err("Only GitHub URLs can be opened externally".to_string()),
    }

    let status = if cfg!(target_os = "macos") {
        Command::new("open").arg(&url).status()
    } else if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "start", "", &url]).status()
    } else {
        Command::new("xdg-open").arg(&url).status()
    }
    .map_err(|error| format!("Failed to open URL: {error}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("Open command failed with status: {status}"))
    }
}
