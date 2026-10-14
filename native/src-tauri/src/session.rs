//! The device token: kept in the app's own store, and shared with the widgets through the widgets plugin.

use serde_json::json;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_midore_widgets::{MidoreWidgetsExt, Session};
use tauri_plugin_store::StoreExt;

use crate::api;

const STORE: &str = "midore.json";

/// In-memory state shared by commands, the deep-link handler and the background refresh.
#[derive(Default)]
pub struct AppState {
    pub token: Mutex<Option<String>>,
    pub me: Mutex<Option<api::Me>>,
    pub agenda: Mutex<Option<api::Agenda>>,
    /// The `state` value of the browser sign-in in progress, to match the midore:// reply.
    pub pending_state: Mutex<Option<String>>,
}

pub fn load<R: Runtime>(app: &AppHandle<R>) {
    let token = app
        .store(STORE)
        .ok()
        .and_then(|s| s.get("token"))
        .and_then(|v| v.as_str().map(String::from));
    *app.state::<AppState>().token.lock().unwrap() = token.clone();
    share(app, token);
}

pub fn token<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    app.state::<AppState>().token.lock().unwrap().clone()
}

pub fn save<R: Runtime>(app: &AppHandle<R>, token: &str) {
    if let Ok(store) = app.store(STORE) {
        store.set("token", json!(token));
        let _ = store.save();
    }
    *app.state::<AppState>().token.lock().unwrap() = Some(token.to_string());
    share(app, Some(token.to_string()));
}

pub fn clear<R: Runtime>(app: &AppHandle<R>) {
    if let Ok(store) = app.store(STORE) {
        store.delete("token");
        store.delete("lastAgenda");
        let _ = store.save();
    }
    let state = app.state::<AppState>();
    *state.token.lock().unwrap() = None;
    *state.me.lock().unwrap() = None;
    *state.agenda.lock().unwrap() = None;
    share(app, None);
}

/// Hand the token and server to the widgets (or tell them we signed out).
fn share<R: Runtime>(app: &AppHandle<R>, token: Option<String>) {
    let _ = app.midore_widgets().set_session(Session { token, base_url: api::base_url() });
}

/// Remember the sign-in attempt in progress across an app restart.
pub fn keep_pending<R: Runtime>(app: &AppHandle<R>, state: &str) {
    if let Ok(store) = app.store(STORE) {
        store.set("pendingState", json!(state));
        let _ = store.save();
    }
}

pub fn take_pending<R: Runtime>(app: &AppHandle<R>) -> Option<String> {
    let store = app.store(STORE).ok()?;
    let v = store.get("pendingState").and_then(|v| v.as_str().map(String::from));
    store.delete("pendingState");
    let _ = store.save();
    v
}

/// The last agenda from the server, shown by the app's own start page when Midore can't be reached.
pub fn keep_agenda<R: Runtime>(app: &AppHandle<R>, agenda: &serde_json::Value) {
    if let Ok(store) = app.store(STORE) {
        store.set("lastAgenda", agenda.clone());
        let _ = store.save();
    }
}

pub fn cached_agenda<R: Runtime>(app: &AppHandle<R>) -> Option<serde_json::Value> {
    app.store(STORE).ok()?.get("lastAgenda")
}
