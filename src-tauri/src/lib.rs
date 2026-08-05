mod fs;
mod git;
mod secrets;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            git::run_git,
            git::git_available,
            secrets::set_secret,
            secrets::get_secret,
            secrets::delete_secret,
            fs::fs_list_markdown,
            fs::fs_read_file,
            fs::fs_write_file,
            fs::fs_delete_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenNotes");
}
