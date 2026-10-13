// Adds Midore's home-screen widgets to Tauri's generated Android project (src-tauri/gen/android): copies the
// sources from widgets/android and registers the widgets, their list services and midore:// links in the
// manifest. Safe to run again; run it after `tauri android init`.
import { cpSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const main = join(root, "src-tauri", "gen", "android", "app", "src", "main");
cpSync(join(root, "widgets", "android", "src", "main"), main, { recursive: true });

const manifestPath = join(main, "AndroidManifest.xml");
let manifest = readFileSync(manifestPath, "utf8");
const MARK = "<!-- MIDORE WIDGETS -->";

const receiver = (cls, info, extra = "") => `
        <receiver android:name="app.midore.widgets.${cls}" android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="app.midore.widgets.REFRESH" />${extra}
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/midore_${info}_info" />
        </receiver>`;

if (!manifest.includes(MARK)) {
  const block = `
        ${MARK}${receiver("TodayWidget", "today")}${receiver("NowNextWidget", "now")}${receiver(
          "TasksWidget",
          "tasks",
          '\n                <action android:name="app.midore.widgets.COMPLETE" />',
        )}${receiver("DoriWidget", "dori")}${receiver("BookingWidget", "booking", '\n                <action android:name="app.midore.widgets.COPY" />')}
        <service android:name="app.midore.widgets.AgendaService" android:exported="false" android:permission="android.permission.BIND_REMOTEVIEWS" />
        <service android:name="app.midore.widgets.TasksService" android:exported="false" android:permission="android.permission.BIND_REMOTEVIEWS" />
`;
  manifest = manifest.replace("    </application>", `${block}    </application>`);
}

// midore:// links (the sign-in reply from the browser, and widget taps) open the app.
if (!manifest.includes('android:scheme="midore"')) {
  manifest = manifest.replace(
    "            </intent-filter>\n        </activity>",
    `            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="midore" />
            </intent-filter>
        </activity>`,
  );
}
writeFileSync(manifestPath, manifest);
console.log("Android project: widgets and midore:// links in place.");
