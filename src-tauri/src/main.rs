// Prevents additional console window on Windows in release, keeps logs on macOS dev.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    opennotes_lib::run()
}
