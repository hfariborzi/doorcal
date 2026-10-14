//! Midore for Mac, Windows, Linux, iPhone and Android.
//!
//! The main window shows the Midore web app from the server, signed in with a one-time code, so every feature
//! ships with a normal web deploy. Around it the app adds what only an app can do: sign-in through the system
//! browser, the tray or menu bar (now and next), a global shortcut for quick add and Dori, notifications when
//! planned work starts and ends, start at login, updates, and the native widgets (see native/widgets).

mod api;
mod session;

#[cfg(desktop)]
mod desktop;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

use session::AppState;

/// The app's own bundled pages (sign-in screen, quick add).
pub fn local_url(page: &str) -> Url {
    let base = if cfg!(any(target_os = "windows", target_os = "android")) { "http://tauri.localhost/" } else { "tauri://localhost/" };
    Url::parse(base).and_then(|u| u.join(page)).expect("local url")
}

fn server_host() -> String {
    Url::parse(&api::base_url()).ok().and_then(|u| u.host_str().map(String::from)).unwrap_or_default()
}

/// Inside the main window, only Midore itself loads. Everything else (meeting links, Google sign-in for
/// reconnecting a calendar, help pages) opens in the person's browser: Google and Microsoft refuse sign-in in
/// embedded web views, and links to other sites belong in the browser anyway.
fn allow_navigation<R: Runtime>(app: &AppHandle<R>, url: &Url) -> bool {
    match url.scheme() {
        "tauri" | "about" | "data" | "blob" => return true,
        "http" | "https" => {}
        _ => {
            let _ = app.opener().open_url(url.as_str(), None::<&str>);
            return false;
        }
    }
    let host = url.host_str().unwrap_or_default();
    if host == "tauri.localhost" || host == "ipc.localhost" {
        return true;
    }
    if host == server_host() {
        let path = url.path();
        // Signing out on the web signs the app out too; OAuth flows go to the browser.
        if path.starts_with("/api/auth/") && path != "/api/auth/logout" {
            let _ = app.opener().open_url(url.as_str(), None::<&str>);
            return false;
        }
        return true;
    }
    let _ = app.opener().open_url(url.as_str(), None::<&str>);
    false
}

fn create_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let handle = app.clone();
    let builder = WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into())).on_navigation(move |url| allow_navigation(&handle, url));
    #[cfg(desktop)]
    let builder = builder.title("Midore").inner_size(1280.0, 820.0).min_inner_size(380.0, 520.0).center();
    let window = builder.build()?;
    // Phones show the window's own colour below the page (behind the home bar): match the app's canvas.
    #[cfg(mobile)]
    {
        use tauri::window::Color;
        let dark = matches!(window.theme(), Ok(tauri::Theme::Dark));
        let _ = window.set_background_color(Some(if dark { Color(18, 16, 22, 255) } else { Color(251, 248, 252, 255) }));
    }
    #[cfg(desktop)]
    let _ = window;
    Ok(())
}

/// Sign the main window into the web app with a one-time code and show the dashboard.
async fn open_web_inner<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let Some(token) = session::token(app) else { return Err("Signed out".into()) };
    match api::webview_code(&token).await {
        Ok(code) => {
            let url = Url::parse(&format!("{}/api/native/session?code={}", api::base_url(), code)).map_err(|e| e.to_string())?;
            if let Some(w) = app.get_webview_window("main") {
                w.navigate(url).map_err(|e| e.to_string())?;
            }
            Ok(())
        }
        Err(api::ApiError::SignedOut) => {
            sign_out_inner(app);
            Err(api::ApiError::SignedOut.to_string())
        }
        Err(e) => Err(e.to_string()),
    }
}

fn sign_out_inner<R: Runtime>(app: &AppHandle<R>) {
    session::clear(app);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.navigate(local_url("index.html"));
    }
    #[cfg(desktop)]
    desktop::refresh_now(app);
}

/// midore:// links: `auth` finishes signing in (from the browser); `open`, `quick` and `copy-link` come from the
/// widgets.
fn handle_link<R: Runtime>(app: &AppHandle<R>, url: &Url) {
    if url.scheme() != "midore" {
        return;
    }
    match url.host_str() {
        Some("auth") => {}
        Some("quick") => {
            #[cfg(desktop)]
            desktop::open_quick(app);
            #[cfg(mobile)]
            show_main(app);
            return;
        }
        Some("copy-link") => {
            #[cfg(desktop)]
            desktop::copy_booking_link(app);
            #[cfg(mobile)]
            show_main(app);
            return;
        }
        _ => {
            show_main(app);
            return;
        }
    }
    let q: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
    let (Some(code), Some(state)) = (q.get("code").cloned(), q.get("state").cloned()) else { return };
    // Phones may stop the app while the browser is open, so the attempt is also kept in the store.
    let expected = app.state::<AppState>().pending_state.lock().unwrap().take().or_else(|| session::take_pending(app));
    if expected.as_deref() != Some(state.as_str()) {
        let _ = app.emit("auth-error", "That sign-in link was for an earlier attempt. Choose Sign in again.");
        return;
    }
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        match api::exchange_code(&code).await {
            Ok(token) => {
                session::save(&app, &token);
                let _ = open_web_inner(&app).await;
                #[cfg(desktop)]
                desktop::refresh_now(&app);
            }
            Err(e) => {
                let _ = app.emit("auth-error", e.to_string());
            }
        }
    });
}

fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        #[cfg(desktop)]
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    signed_in: bool,
    platform: &'static str,
    platform_label: &'static str,
    server: String,
}

#[tauri::command]
fn status(app: AppHandle) -> Status {
    Status { signed_in: session::token(&app).is_some(), platform: api::platform(), platform_label: api::platform_label(), server: api::base_url() }
}

/// Start signing in: open the browser at the connect page; the reply comes back as a midore:// link.
#[tauri::command]
fn sign_in(app: AppHandle) -> Result<(), String> {
    use rand::Rng;
    let state: String = rand::thread_rng().sample_iter(&rand::distributions::Alphanumeric).take(24).map(char::from).collect();
    *app.state::<AppState>().pending_state.lock().unwrap() = Some(state.clone());
    session::keep_pending(&app, &state);
    let mut url = Url::parse(&format!("{}/native/connect", api::base_url())).map_err(|e| e.to_string())?;
    url.query_pairs_mut()
        .append_pair("platform", api::platform())
        .append_pair("state", &state)
        .append_pair("name", &format!("Midore for {}", api::platform_label()));
    app.opener().open_url(url.as_str(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
async fn open_web(app: AppHandle) -> Result<(), String> {
    open_web_inner(&app).await
}

#[tauri::command]
fn sign_out(app: AppHandle) {
    sign_out_inner(&app);
}

#[tauri::command]
async fn quick_add(app: AppHandle, title: String) -> Result<(), String> {
    let token = session::token(&app).ok_or("Sign in first.")?;
    api::add_task(&token, &title).await.map_err(|e| e.to_string())?;
    #[cfg(desktop)]
    desktop::refresh_now(&app);
    Ok(())
}

#[derive(Serialize)]
struct Reply {
    text: String,
    actions: Vec<String>,
}

#[tauri::command]
async fn ask_dori(app: AppHandle, text: String) -> Result<Reply, String> {
    let token = session::token(&app).ok_or("Sign in first.")?;
    let r = api::ask_dori(&token, &text).await.map_err(|e| e.to_string())?;
    #[cfg(desktop)]
    desktop::refresh_now(&app);
    Ok(Reply { text: r.text, actions: r.actions })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct QuickInfo {
    dori_enabled: bool,
    dori_character: String,
}

#[tauri::command]
async fn quick_info(app: AppHandle) -> Result<QuickInfo, String> {
    let token = session::token(&app).ok_or("Sign in first.")?;
    let me = api::me(&token).await.map_err(|e| e.to_string())?;
    Ok(QuickInfo { dori_enabled: me.dori.enabled, dori_character: me.dori.character })
}

#[tauri::command]
fn hide_quick(app: AppHandle) {
    if let Some(w) = app.get_webview_window("quick") {
        let _ = w.hide();
    }
}

/// The menu bar calendar: one day's events and planned work.
#[tauri::command]
async fn mini_day(app: AppHandle, date: Option<String>) -> Result<serde_json::Value, String> {
    let token = session::token(&app).ok_or("Sign in first.")?;
    match api::day(&token, date.as_deref()).await {
        Err(api::ApiError::SignedOut) => {
            sign_out_inner(&app);
            Err(api::ApiError::SignedOut.to_string())
        }
        r => r.map_err(|e| e.to_string()),
    }
}

#[tauri::command]
async fn mark_done(app: AppHandle, task_id: i64, start: String, end: String) -> Result<(), String> {
    let token = session::token(&app).ok_or("Sign in first.")?;
    api::mark_done(&token, task_id, &start, &end).await.map_err(|e| e.to_string())?;
    #[cfg(desktop)]
    desktop::refresh_now(&app);
    Ok(())
}

/// Meeting links from the menu bar calendar open in the browser.
#[tauri::command]
fn open_link(app: AppHandle, url: String) -> Result<(), String> {
    let parsed = Url::parse(&url).map_err(|e| e.to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https links open from here.".into());
    }
    app.opener().open_url(parsed.as_str(), None::<&str>).map_err(|e| e.to_string())
}

#[tauri::command]
fn close_mini(app: AppHandle) {
    #[cfg(desktop)]
    desktop::hide_mini(&app);
    #[cfg(mobile)]
    let _ = app;
}

#[tauri::command]
fn open_main(app: AppHandle) {
    #[cfg(desktop)]
    desktop::hide_mini(&app);
    show_main(&app);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // A second launch (or a midore:// link on Windows and Linux) goes to the running app instead.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_midore_widgets::init())
        .manage(AppState::default())
        .setup(|app| {
            let handle = app.handle().clone();
            session::load(&handle);
            create_main_window(&handle)?;

            #[cfg(any(target_os = "linux", all(debug_assertions, target_os = "windows")))]
            {
                let _ = app.deep_link().register_all();
            }
            let links = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_link(&links, &url);
                }
            });
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    handle_link(&handle, &url);
                }
            }

            #[cfg(desktop)]
            desktop::setup(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![status, sign_in, open_web, sign_out, quick_add, ask_dori, quick_info, hide_quick, mini_day, mark_done, open_link, open_main, close_mini])
        .build(tauri::generate_context!())
        .expect("error while building Midore")
        .run(|_app, _event| {
            // On macOS, keep running in the menu bar when the window closes.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::ExitRequested { api, code, .. } = _event {
                if code.is_none() {
                    api.prevent_exit();
                }
            }
        });
}
