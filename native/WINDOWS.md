# Midore for Windows: build handoff

For an agent (or person) working on a Windows 11 machine. Everything except Windows was built and tested on a Mac
(see `README.md`); the server side (`/api/v1`, device sign-in) is live. This document covers building the Windows app, its Widgets board widgets, packaging and the
Microsoft Store. Read `README.md` first for how the app works.

## 0. What already exists

- `native/` is one Tauri 2 app for all platforms. It compiles for Windows without changes in theory; nobody has
  built it on Windows yet, so treat the first build as a test.
- Windows-specific code that already exists:
  - `src-tauri/src/main.rs`: no console window in release builds.
  - `src-tauri/src/lib.rs`: `midore://` registration at runtime in debug builds (installers register it in
    release); local pages load from `http://tauri.localhost/`.
  - `plugins/widgets/src/desktop.rs`: on Windows it writes `%LOCALAPPDATA%\Midore\widgets\session.json` with
    `{ "token": "mdr_…", "baseUrl": "https://midore.app" }` when the person signs in, and deletes it on sign-out.
    The widget provider reads this file. (Inside an MSIX package, `%LOCALAPPDATA%` writes may be redirected to the
    package's own LocalCache; the provider runs in the same package, so it sees the same redirected path. Verify.)
- The tray, Alt+Space quick add, notifications, open at login and the updater are shared desktop code
  (`src-tauri/src/desktop.rs`) and should work on Windows as they are.

## 1. Tools to install

1. **Git**, **Node.js 22**, and **Rust** (rustup, default `stable-x86_64-pc-windows-msvc`).
2. **Visual Studio 2022 Build Tools** with "Desktop development with C++" and a Windows 11 SDK (needed by Rust and
   for `makeappx.exe` / `signtool.exe`).
3. **WebView2**: preinstalled on Windows 11.
4. For the widgets: **.NET 8 SDK** and the **Windows App SDK** (NuGet `Microsoft.WindowsAppSDK`, 1.5 or later).
   Visual Studio 2022 with the "Windows application development" workload makes this easiest.
5. Turn on **Developer Mode** (Settings > System > For developers) to install unsigned MSIX packages for testing.

## 2. Build the app (no widgets yet)

```powershell
cd native
npm ci
# Optional: the updater key, so the build also makes signed update packages.
$env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $HOME\.tauri\midore-updater.key -Raw   # copy the key from the owner
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = ""
npx tauri build
# Without the key, skip updater artifacts:
npx tauri build --config '{\"bundle\":{\"createUpdaterArtifacts\":false}}'
```

Output: `src-tauri\target\release\bundle\nsis\Midore_0.1.0_x64-setup.exe` and `...\msi\Midore_0.1.0_x64_en-US.msi`.

**Check after installing:**
- The window opens on the sign-in screen.
- "Sign in with your browser" opens the default browser at `https://midore.app/native/connect?platform=windows…`.
- After signing in and choosing Connect, the browser opens `midore://auth?…`, Windows asks to open Midore, and the
  app shows the calendar.
- The tray icon menu shows Now / Next, Open Midore, Quick add, Copy booking link, Open at login, Sign out, Quit.
- Alt+Space opens the quick box; Enter adds a task.
- `%LOCALAPPDATA%\Midore\widgets\session.json` exists while signed in.

If something fails, fix it in the shared code with `#[cfg(target_os = "windows")]` where needed, and make sure
the Mac build still compiles.

## 3. Windows widgets (Widgets board, Win + W)

Windows widgets are not part of Tauri. They need:
1. a **widget provider**: a small out-of-process COM server that implements `IWidgetProvider` from the Windows App
   SDK (`Microsoft.Windows.Widgets.Providers`);
2. **Adaptive Card** templates for each widget (starting templates in `widgets/windows/cards/`);
3. an **MSIX package** that contains both Midore.exe and the provider and declares the widgets in its
   `Package.appxmanifest`. Widgets only work for packaged apps.

### 3.1 The provider (to write)

Create `native/widgets/windows/MidoreWidgetProvider/` as a C# .NET 8 console app (`WinExe`, `net8.0-windows10.0.19041.0`,
`<UseWinUI>false</UseWinUI>`, package `Microsoft.WindowsAppSDK`). Follow Microsoft's "Implement a widget provider in
a C# Windows App" walkthrough for the COM server boilerplate (class factory, `CoRegisterClassObject`, keep-alive).

Widgets to provide (ids must match the manifest):

| Widget id | Name | Sizes | Card | Data |
|---|---|---|---|---|
| `Midore.Today` | Today | medium, large | `cards/today.json` | `GET /api/v1/agenda?days=1` |
| `Midore.NowNext` | Now and next | small, medium | `cards/now.json` | same |
| `Midore.Tasks` | Tasks | medium, large | `cards/tasks.json` | `GET /api/v1/tasks` |

Behaviour:
- Read `%LOCALAPPDATA%\Midore\widgets\session.json`. No file or no token: show the card's signed-out state
  ("Open Midore and sign in").
- Call the API with header `Authorization: Bearer <token>`. 401 means signed out (show that state). Other errors:
  keep the last data and show "Can't reach Midore right now".
- Refresh every 15 minutes while a widget is active (`Activate` / `Deactivate`), and on `OnActionInvoked`.
- Tasks: the card's `Action.Execute` with verb `complete` and data `{ "taskId": 123 }` calls
  `POST /api/v1/tasks/123/status` with `{ "status": "done" }`, then refreshes.
- Tapping the widget title opens `midore://open` (the app handles it).
- Times in the person's timezone (`timezone` in the agenda), short form: `9:30`, `2 pm`.
- Adaptive Cards can't use arbitrary hex colours, so the category colour (`color`) is not shown; the cards stay
  neutral and follow the Widgets board theme. If a later Adaptive Cards version allows it, events get the colour as
  a left bar and tasks as an underline (see `DESIGN.md` at the repo root).

Data the provider passes with each card (`WidgetUpdateRequestOptions.Data`, JSON):

| Card | Data |
|---|---|
| `today.json` | `{ signedIn, dayLabel: "Tuesday 13", items: [{ time, title, done }], status }` (at most 6 items for medium, 12 for large) |
| `now.json` | `{ signedIn, now: { title, left: "25 min left" } \| null, next: { time, title } \| null, status }` |
| `tasks.json` | `{ signedIn, tasks: [{ id, title, due: "Due Friday" \| "" }], status }` (at most 5 / 10) |

`status` is `""` normally, or "Can't reach Midore right now", or "A calendar needs reconnecting" when `problems`
is not empty.

API response shapes (JSON):

```jsonc
// GET /api/v1/agenda?days=1   (days 1–7)
{ "timezone": "America/Edmonton", "generatedAt": "…", "start": "…", "end": "…",
  "items": [
    { "kind": "event", "id": "3:abc", "title": "…", "start": "2026-10-13T15:00:00.000Z", "end": "…",
      "allDay": false, "color": "#4a6a8c", "location": null, "meetLink": null },
    { "kind": "task", "id": "12:2026-…", "taskId": 12, "title": "…", "start": "…", "end": "…", "allDay": false,
      "color": "#e11d48", "state": "open" | "missed" | "partly" | "good_enough" | "done",
      "progress": 40, "pinned": false } ],
  "now": { /* an item, or null */ }, "next": { /* an item, or null */ },
  "problems": [ { "email": "…", "message": "…" } ] }   // calendars that need reconnecting
// GET /api/v1/tasks   (open tasks, at most 30, due first)
{ "tasks": [ { "id": 12, "title": "…", "kind": "task" | "reminder", "dueDate": "2026-10-20" | null,
               "progress": 0, "priority": …, "color": "#557563" } ] }
// POST /api/v1/tasks/12/status   body { "status": "open" | "done" | "good_enough" | "dropped" }  → { "ok": true }
// GET /api/v1/me
{ "name": "…", "email": "…", "timezone": "…", "bookingUrl": "https://midore.app/…",
  "dori": { "enabled": true, "character": "puppy" } }
```
Errors come back as `{ "error": "…" }` with 400, 401 (token revoked or signed out) or 429 (240 requests a minute
per device).


### 3.2 Packaging (MSIX)

Tauri makes NSIS and MSI installers, not MSIX. Options:
- **Recommended:** a Windows Application Packaging Project (Visual Studio) or a hand-written
  `Package.appxmanifest` plus `makeappx pack`, containing `Midore.exe` (from `src-tauri\target\release\`), the
  provider build output, and the icons (`src-tauri\icons\Square*Logo.png`, `StoreLogo.png`).
- The manifest needs:
  - `<Identity Name=… Publisher=…>` from Partner Center (section 4) for Store builds; any test values locally.
  - the app: `<Application Id="Midore" Executable="Midore.exe" EntryPoint="Windows.FullTrustApplication">`,
    capability `runFullTrust`.
  - the `midore` protocol: `<uap:Extension Category="windows.protocol"><uap:Protocol Name="midore"/></uap:Extension>`
    (MSIX builds should not rely on the runtime registration).
  - the COM server for the provider: `<com:Extension Category="windows.comServer">` with an `ExeServer` pointing at
    the provider exe and a fixed CLSID.
  - the widget declaration: `<uap3:Extension Category="windows.appExtension"><uap3:AppExtension
    Name="com.microsoft.windows.widgets" Id="MidoreWidgets" DisplayName="Midore" PublicFolder="Public">` with
    `<uap3:Properties><WidgetProvider><ProviderIcons/><Activation><CreateInstance ClassId="<same CLSID>"/></Activation>
    <Definitions>` one `<Definition Id="Midore.Today" DisplayName="Today" Description=…>` per widget, with
    `<Capabilities><Capability><Size Name="medium"/></Capability>…</Capabilities>` and screenshots/icons.
  Copy the exact schema from Microsoft's "Widget provider package manifest XML format" page; it changes between
  Windows App SDK versions.
- Test: `Add-AppxPackage` the unsigned package in Developer Mode, open Widgets (Win + W) > Add widgets > Midore.

### 3.3 Updates with MSIX

The Tauri updater replaces an NSIS/MSI install; it cannot update an MSIX package. Two channels:
- **Microsoft Store (MSIX):** the Store updates the app; build with the updater turned off
  (`--config '{\"plugins\":{\"updater\":{\"active\":false}}}'` or remove the updater check for this build).
- **Direct download (NSIS):** the Tauri updater; no Windows widgets in this channel (widgets need MSIX).
Recommendation: publish the MSIX in the Store as the main Windows build, and keep the NSIS installer as a plain
download without widgets.

## 4. Microsoft Store

1. Register at storedeveloper.microsoft.com (free for individuals; ID and selfie check).
2. Partner Center > Apps and games > New product > MSIX or PWA app > reserve the name **Midore**.
3. Product identity gives `Package/Identity/Name`, `Publisher` and `PublisherDisplayName`: put them in the
   manifest.
4. Upload the `.msixupload` / `.msix`. Microsoft signs Store packages, so no certificate is needed for the Store.
5. Listing: description from `README.md`, privacy policy `https://midore.app/privacy`, category Productivity,
   screenshots of the calendar, the tray menu and the widgets.

Direct downloads outside the Store need a code-signing certificate (for example Azure Trusted Signing), set in
`bundle.windows.signCommand` or `certificateThumbprint` in `tauri.conf.json`.

## 5. CI (after the local build works)

Add a `windows` job to `.github/workflows/native.yml` mirroring the `linux` job on `windows-latest`
(`npx tauri build --bundles nsis,msi`), and later a job that builds the provider and the MSIX.

## 6. Done means

- [ ] NSIS and MSI build; the app installs, signs in through the browser, and shows the calendar.
- [ ] Tray, Alt+Space quick add, notifications and open at login work.
- [ ] MSIX with the widget provider installs in Developer Mode; Today, Now and next and Tasks widgets show real
      data; ticking a task marks it done on midore.app.
- [ ] Partner Center product reserved; the Store package passes the Windows App Certification Kit.
- [ ] Changes committed under `native/` and pushed to `main`, with this file updated to say what was verified.
