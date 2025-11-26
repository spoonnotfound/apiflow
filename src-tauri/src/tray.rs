use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    let status_item = MenuItem::with_id(app, "status", "状态: 已停止", false, None::<&str>)?;
    let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
    let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&status_item, &separator, &show_item, &quit_item])?;

    let icon = Image::from_bytes(include_bytes!("../icons/tray-iconTemplate@2x.png"))?;

    TrayIconBuilder::with_id("main")
        .icon(icon)
        .icon_as_template(true)
        .tooltip("ApiFlow - 已停止")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
pub fn update_tray_status(
    app: tauri::AppHandle,
    running: bool,
    port: u16,
    processing_count: Option<u32>,
) -> Result<(), String> {
    let active_processing = processing_count.unwrap_or(0);
    let processing_suffix = if active_processing > 0 {
        format!(" · 处理中 {}", active_processing)
    } else {
        "".to_string()
    };

    if let Some(tray) = app.tray_by_id("main") {
        let tooltip = if running {
            format!("ApiFlow - 运行中 ({}){}", port, processing_suffix)
        } else {
            "ApiFlow - 已停止".to_string()
        };
        tray.set_tooltip(Some(&tooltip)).map_err(|e| e.to_string())?;

        let status_text = if running {
            if active_processing > 0 {
                format!("● 运行中 - 端口 {} · 处理中 {}", port, active_processing)
            } else {
                format!("● 运行中 - 端口 {}", port)
            }
        } else {
            "○ 已停止".to_string()
        };

        let status_item = MenuItem::with_id(&app, "status", &status_text, false, None::<&str>)
            .map_err(|e| e.to_string())?;
        let separator = tauri::menu::PredefinedMenuItem::separator(&app)
            .map_err(|e| e.to_string())?;
        let show_item = MenuItem::with_id(&app, "show", "显示窗口", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        let quit_item = MenuItem::with_id(&app, "quit", "退出", true, None::<&str>)
            .map_err(|e| e.to_string())?;
        let menu = Menu::with_items(&app, &[&status_item, &separator, &show_item, &quit_item])
            .map_err(|e| e.to_string())?;

        tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    }
    Ok(())
}
