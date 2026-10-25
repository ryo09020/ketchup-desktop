use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Emitter, LogicalPosition, LogicalSize, Manager, Position, Size,
};

#[tauri::command]
fn update_tray_title(app: tauri::AppHandle, title: String) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_title(Some(title));
    }
    Ok(())
}

#[tauri::command]
fn toggle_mini_mode(app: tauri::AppHandle, mini: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        if mini {
            let _ = window.set_size(Size::Logical(LogicalSize::new(290.0, 96.0)));
            let _ = window.set_always_on_top(true);

            // Automatically dock to the top-right corner of the screen
            if let Ok(Some(monitor)) = window.current_monitor() {
                let scale = monitor.scale_factor();
                let screen_w = monitor.size().width as f64 / scale;
                let target_x = screen_w - 310.0;
                let target_y = 40.0; // right below macOS menu bar
                let _ = window.set_position(Position::Logical(LogicalPosition::new(target_x, target_y)));
            }
        } else {
            let _ = window.set_size(Size::Logical(LogicalSize::new(1050.0, 720.0)));
            let _ = window.set_always_on_top(false);
            let _ = window.center();
        }
    }
    Ok(())
}

#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, always_on_top: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(always_on_top);
    }
    Ok(())
}

#[tauri::command]
fn save_to_obsidian(vault_path: String, filename: String, content: String) -> Result<String, String> {
    let clean_path = vault_path.trim();
    if clean_path.is_empty() {
        return Err("Obsidian Vault パスが設定されていません。設定画面でパスを入力してください。".to_string());
    }

    let expanded_path = if clean_path.starts_with("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            let home_str = home.to_string_lossy();
            clean_path.replacen('~', &home_str, 1)
        } else {
            clean_path.to_string()
        }
    } else {
        clean_path.to_string()
    };

    let base_dir = std::path::Path::new(&expanded_path);
    // If base_dir doesn't end with daily_report or daily_reports, save into daily_report subfolder
    let target_dir = if base_dir.ends_with("daily_report") || base_dir.ends_with("daily_reports") {
        base_dir.to_path_buf()
    } else {
        base_dir.join("daily_report")
    };

    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir)
            .map_err(|e| format!("フォルダの作成に失敗しました ({}): {}", target_dir.display(), e))?;
    }

    let full_path = target_dir.join(filename);
    std::fs::write(&full_path, content)
        .map_err(|e| format!("ファイルの書き込みに失敗しました ({}): {}", full_path.display(), e))?;
    Ok(full_path.to_string_lossy().to_string())
}

#[tauri::command]
fn select_obsidian_folder() -> Result<Option<String>, String> {
    #[cfg(target_os = "macos")]
    {
        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg("POSIX path of (choose folder with prompt \"Obsidian Vault フォルダを選択してください\")")
            .output()
            .map_err(|e| format!("フォルダ選択ダイアログの表示に失敗しました: {}", e))?;

        if output.status.success() {
            let mut path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if path.ends_with('/') {
                path.pop();
            }
            if !path.is_empty() {
                return Ok(Some(path));
            }
        }
        Ok(None)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(None)
    }
}

#[tauri::command]
fn reveal_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg("-R")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Finderの起動に失敗しました: {}", e))?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = path;
    }
    Ok(())
}

// -------------------------------------------------------------
// AI API proxy (OpenAI / Anthropic / Gemini)
// WebView の CORS 制約を避けるため、HTTP 通信はネイティブ(Rust)側で行う
// -------------------------------------------------------------
const ALLOWED_AI_HOSTS: [&str; 3] = [
    "https://api.openai.com/",
    "https://api.anthropic.com/",
    "https://generativelanguage.googleapis.com/",
];

#[derive(serde::Serialize)]
struct AiHttpResponse {
    status: u16,
    body: String,
}

#[tauri::command]
async fn ai_http_request(
    method: String,
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: Option<String>,
) -> Result<AiHttpResponse, String> {
    if !ALLOWED_AI_HOSTS.iter().any(|h| url.starts_with(h)) {
        return Err("許可されていないURLです".to_string());
    }
    let client = reqwest::Client::new();
    let m = reqwest::Method::from_bytes(method.to_uppercase().as_bytes())
        .map_err(|e| e.to_string())?;
    let mut req = client.request(m, &url).timeout(std::time::Duration::from_secs(120));
    for (k, v) in headers.iter() {
        req = req.header(k, v);
    }
    if let Some(b) = body {
        req = req.body(b);
    }
    let res = req.send().await.map_err(|e| format!("通信エラー: {}", e))?;
    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(AiHttpResponse { status, body })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Load bundled white template PNG icon for macOS menu bar tray
            let tray_icon_bytes = include_bytes!("../icons/tray-tomato.png");
            let tray_icon = Image::from_bytes(tray_icon_bytes)
                .expect("failed to load embedded tray icon");

            // Build Tray Menu
            let toggle = MenuItem::with_id(app, "toggle", "ウィンドウを表示 / 隠す", true, None::<&str>)?;
            let toggle_mini = MenuItem::with_id(app, "toggle_mini", "ミニタイマー切替 (画面右上)", true, None::<&str>)?;
            let action_timer = MenuItem::with_id(app, "toggle_timer", "タイマー 開始 / 一時停止", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "KetchUp を終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &toggle_mini, &action_timer, &quit])?;

            // Create Tray Icon (macOS Menu Bar / Status Bar on the top-right)
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .menu(&menu)
                .title(" 25:00")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "toggle" => {
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                    "toggle_mini" => {
                        let _ = app.emit("tray-toggle-mini", ());
                    }
                    "toggle_timer" => {
                        let _ = app.emit("tray-toggle-timer", ());
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            update_tray_title,
            toggle_mini_mode,
            set_always_on_top,
            save_to_obsidian,
            reveal_in_finder,
            select_obsidian_folder,
            ai_http_request
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
