// 会计小当家 - Tauri 2.x 入口
// 前端由 Tauri 自动加载 tauri.conf.json 中配置的 distDir（../dist）
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// 检测系统是否已安装 Microsoft WebView2 Runtime
/// 通过查询 EdgeUpdate 注册表中 WebView2 客户端的安装键来判断
#[cfg(windows)]
fn webview2_installed() -> bool {
    const KEYS: &[&str] = &[
        r"HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKCU\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        r"HKLM\SOFTWARE\Microsoft\EdgeWebView\WebView2\SDK",
    ];
    for key in KEYS {
        if let Ok(out) = std::process::Command::new("reg").args(["query", key]).output() {
            if out.status.success() {
                return true;
            }
        }
    }
    false
}

/// 用 Win32 MessageBox 询问用户是否同意安装
/// 返回 true = 同意（IDYES），false = 拒绝/关闭
#[cfg(windows)]
fn ask_install_consent() -> bool {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        MessageBoxW, IDYES, MB_ICONQUESTION, MB_YESNO, MB_SYSTEMMODAL,
    };

    let title: Vec<u16> = std::ffi::OsStr::new("缺少必要组件")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let msg: Vec<u16> = std::ffi::OsStr::new(
        "本程序运行需要 Microsoft WebView2 运行时。\n是否同意自动下载并安装（约 150MB，需联网）？",
    )
    .encode_wide()
    .chain(std::iter::once(0))
    .collect();

    unsafe { MessageBoxW(std::ptr::null_mut(), msg.as_ptr(), title.as_ptr(), MB_ICONQUESTION | MB_YESNO | MB_SYSTEMMODAL) == IDYES }
}

/// 下载并静默安装 WebView2 Runtime，随后重启本程序
#[cfg(windows)]
fn install_webview2_and_relaunch() {
    use std::process::Command;

    let setup_path = std::env::temp_dir().join("webview2setup.exe");

    // 1) 下载官方引导安装器
    let _ = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "Invoke-WebRequest -Uri 'https://go.microsoft.com/fwlink/p/?LinkId=2124703' -OutFile \"{}\"",
                setup_path.to_string_lossy()
            ),
        ])
        .status();

    // 2) 静默安装
    let _ = Command::new("cmd")
        .args(["/c", &format!("\"{}\" /silent /install", setup_path.to_string_lossy())])
        .status();

    // 3) 重新启动本程序
    if let Ok(exe) = std::env::current_exe() {
        let _ = Command::new(exe).spawn();
    }
    std::process::exit(0);
}

fn main() {
    // 仅 Windows 需要 WebView2 运行时作为渲染后端
    #[cfg(windows)]
    {
        if !webview2_installed() {
            if ask_install_consent() {
                install_webview2_and_relaunch();
            } else {
                // 用户拒绝，退出程序
                std::process::exit(0);
            }
        }
    }

    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
