# Midore apps

One Tauri 2 app for Mac, Windows, Linux, iPhone and Android, plus native widgets for each platform.

## How it works

- **The main window is the web app.** It loads `https://midore.app/dashboard`, signed in with a one-time code, so
  every web deploy reaches the apps without an app update. Only Midore pages load inside it; other links (meeting
  links, Google sign-in for reconnecting calendars) open in the browser.
- **Sign-in goes through the system browser.** The app opens `/native/connect?platform&state&name`, the person
  signs in there, and the site sends them back to `midore://auth?code&state`. The app swaps the code for a device
  token (`mdr_…`) at `/api/native/token`. Devices are listed (and can be disconnected) in Settings > Apps and devices.
- **Everything native talks to `/api/v1`** with `Authorization: Bearer <token>`: `me`, `agenda`, `tasks`,
  `tasks/{id}/status`, `blocks/mark`, `dori`. Server code: `src/lib/native.ts`, `src/lib/api-v1.ts`,
  `src/app/api/v1/`.
- **Widgets get the token from the app** through `plugins/widgets` (a Tauri plugin):
  - macOS: `session.json` in the App Group container `9437GLFKZ8.app.midore`
  - iOS: `UserDefaults(suiteName: "group.app.midore")`
  - Android: SharedPreferences `midore_widgets`, then a `app.midore.widgets.REFRESH` broadcast
  - Windows: `%LOCALAPPDATA%\Midore\widgets\session.json`
  Widgets then call `/api/v1` themselves and refresh on their own schedule.

On desktop the app also has a tray / menu bar item (now and next), Alt+Space for quick add and Dori, notifications
when planned work starts and ends, open at login, and the updater. See `src-tauri/src/desktop.rs`.

## Layout

| Path | What |
|---|---|
| `src-tauri/` | The Rust app (`src/lib.rs` main flow, `api.rs` server calls, `session.rs` token, `desktop.rs` tray and friends) |
| `src-tauri/gen/apple`, `gen/android` | Tauri's generated mobile projects, committed **with Midore's patches** (see scripts) |
| `ui/` | The app's own small pages: sign-in screen (`index.html`) and the quick add box (`quick.html`) |
| `plugins/widgets/` | Tauri plugin that hands the token to the widgets |
| `widgets/apple/` | SwiftUI WidgetKit widgets shared by Mac and iPhone (`project.yml` builds the Mac extension) |
| `widgets/android/` | Android home screen widgets (RemoteViews) |
| `widgets/windows/` | Adaptive Card templates for the Windows widgets; the provider is still to build, see `WINDOWS.md` |
| `scripts/` | `before-bundle.mjs` (builds the Mac widget), `ios-widget.mjs`, `android-widget.mjs` (patch the generated projects) |

## Build

Needs Node 22 and Rust stable. `npm ci` first. Point at a local server with `MIDORE_URL=http://localhost:3000`.

| Platform | Command | Notes |
|---|---|---|
| Mac | `npx tauri build` | Needs Xcode and `brew install xcodegen`. Signs with the Developer ID certificate. Output in `src-tauri/target/release/bundle/{macos,dmg}`. |
| Linux | `npx tauri build --bundles deb,rpm,appimage` | Built in CI (`.github/workflows/native.yml`). Linux has no widgets. |
| iPhone | `npx tauri ios dev` / `npx tauri ios build` | Simulator works now. A real device needs an Apple Development certificate and the App Group `group.app.midore` registered for `app.midore` and `app.midore.widgets`. |
| Android | `npx tauri android dev` / `npx tauri android build` | Needs Android Studio, SDK and NDK (`ANDROID_HOME`, `NDK_HOME`). |
| Windows | see `WINDOWS.md` | |

Development: `npx tauri dev` (desktop) runs against `MIDORE_URL` or midore.app.

**Widget sources:** after editing `widgets/android`, run `node scripts/android-widget.mjs` (it copies them into the
generated project). If you ever re-run `tauri ios init` or `tauri android init`, run both scripts again: they add the
widget targets, App Group, `midore://` links and manifest entries.

**Icons:** `npm run icons` regenerates every size from `assets/icon.png`.

## Releases and updates

- Bump `version` in `src-tauri/tauri.conf.json` (and `package.json`).
- Desktop updates use the Tauri updater: builds sign update packages with the key in `TAURI_SIGNING_PRIVATE_KEY`
  (owner keeps it; the public key is in `tauri.conf.json`). The app checks
  `https://github.com/hfariborzi/midore/releases/latest/download/latest.json`, so a release needs the bundles, their
  `.sig` files and a `latest.json` attached to a GitHub release.
- Mac downloads also need notarization (App Store Connect API key: `APPLE_API_KEY`, `APPLE_API_ISSUER`,
  `APPLE_API_KEY_PATH`), not set up yet.
- iPhone and Android update through the App Store and Google Play. Most changes ship as web deploys and need no
  app update at all.

## Not done yet

- Windows build and widgets (`WINDOWS.md`).
- Mac notarization; App Store and Google Play listings; real-device iPhone signing.
- Push notifications (widgets and the tray poll instead).
