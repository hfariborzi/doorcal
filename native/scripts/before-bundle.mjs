// Runs before Tauri bundles the app. On macOS desktop builds it builds the WidgetKit extension so Tauri can copy
// it into Midore.app/Contents/PlugIns (see bundle.macOS.files). Other platforms have nothing to do here: the iPhone
// and Android widgets are built inside their own Xcode and Gradle projects.
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = process.env.TAURI_ENV_PLATFORM ?? process.platform;

if (process.platform === "darwin" && (target === "darwin" || target === "macos")) {
  const dir = join(root, "widgets", "apple");
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, stdio: "inherit" });
  run("xcodegen", ["generate", "--quiet"]);
  run("xcodebuild", ["-project", "MidoreWidgetsMac.xcodeproj", "-scheme", "MidoreWidgets", "-configuration", "Release", "-derivedDataPath", "build/dd", "-quiet", "build"]);
}
