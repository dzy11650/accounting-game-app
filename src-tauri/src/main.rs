// 会计小当家 - Tauri 2.x 入口
// 前端由 Tauri 自动加载 tauri.conf.json 中配置的 distDir（../dist）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
