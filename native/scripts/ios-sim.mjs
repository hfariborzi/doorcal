// Build Midore for the iPhone simulator, sign it locally with its entitlements, install and launch it on the
// booted simulator. Without the entitlements (a plain --no-sign build) the app and its widgets don't share the
// App Group, so widgets say "sign in" while the app is signed in.
//   node scripts/ios-sim.mjs            build, sign, install, launch
//   node scripts/ios-sim.mjs --no-build sign, install and launch the last build
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const gen = join(root, "src-tauri", "gen", "apple");
const app = join(gen, "build", "arm64-sim", "Midore.app");
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: "inherit", cwd: root, ...opts });

if (!process.argv.includes("--no-build")) run("npx", ["tauri", "ios", "build", "--debug", "--target", "aarch64-sim", "--no-sign", "--ci"]);

// Extensions first, then the app around them. "-" is a local (ad hoc) signature: enough for the simulator.
const sign = (path, entitlements) => run("codesign", ["--force", "--sign", "-", "--entitlements", join(gen, entitlements), path]);
const plugins = join(app, "PlugIns");
for (const ext of existsSync(plugins) ? readdirSync(plugins) : []) {
  const info = execFileSync("/usr/libexec/PlistBuddy", ["-c", "Print :NSExtension:NSExtensionPointIdentifier", join(plugins, ext, "Info.plist")]).toString().trim();
  sign(join(plugins, ext), info === "com.apple.share-services" ? "MidoreShare_iOS/MidoreShare_iOS.entitlements" : "MidoreWidgets_iOS/MidoreWidgets_iOS.entitlements");
}
sign(app, "midore_iOS/midore_iOS.entitlements");

try {
  execFileSync("xcrun", ["simctl", "terminate", "booted", "app.midore"], { stdio: "ignore" });
} catch {
  // not running
}
run("xcrun", ["simctl", "install", "booted", app]);
run("xcrun", ["simctl", "launch", "booted", "app.midore"]);
console.log("Midore is running on the simulator, with widgets sharing the app's sign-in.");
