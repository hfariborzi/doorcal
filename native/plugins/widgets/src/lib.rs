//! Midore widgets bridge.
//!
//! The widgets (WidgetKit on macOS and iOS, Jetpack Glance on Android, the Widgets board provider on Windows) run
//! outside the app and fetch their data from /api/v1 on their own. This plugin hands them the device token and the
//! server address, and asks the system to refresh them:
//! - macOS: a file in the App Group container `9437GLFKZ8.app.midore` (team-prefixed, works with Developer ID).
//! - iOS: the shared App Group `group.app.midore` (UserDefaults), then WidgetCenter reload.
//! - Android: SharedPreferences `midore_widgets`, then a refresh broadcast to the app's widget receivers.
//! - Windows: `%LOCALAPPDATA%\Midore\widgets\session.json`, read by the widget provider in the MSIX package.
//! - Linux: nothing (no common widget system).

use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use models::*;

#[cfg(desktop)]
mod desktop;
#[cfg(mobile)]
mod mobile;

mod error;
mod models;

pub use error::{Error, Result};

#[cfg(desktop)]
use desktop::MidoreWidgets;
#[cfg(mobile)]
use mobile::MidoreWidgets;

pub trait MidoreWidgetsExt<R: Runtime> {
    fn midore_widgets(&self) -> &MidoreWidgets<R>;
}

impl<R: Runtime, T: Manager<R>> crate::MidoreWidgetsExt<R> for T {
    fn midore_widgets(&self) -> &MidoreWidgets<R> {
        self.state::<MidoreWidgets<R>>().inner()
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("midore-widgets")
        .setup(|app, api| {
            #[cfg(mobile)]
            let w = mobile::init(app, api)?;
            #[cfg(desktop)]
            let w = desktop::init(app, api)?;
            app.manage(w);
            Ok(())
        })
        .build()
}
