/**
 * Sign-in for the desktop and phone apps (native/).
 *
 * 1. The app opens the system browser at /native/connect?platform=…&state=…. Google and Microsoft refuse sign-in
 *    inside an app's embedded web view, so sign-in always happens in a real browser.
 * 2. After the person signs in there (the usual web flow) and approves, the server creates a one-time "connect"
 *    code and hands it to the app through the midore:// link.
 * 3. The app exchanges the code at /api/native/token for a long-lived device token and keeps it in its own storage.
 *    The app's widgets and tray call /api/v1 with that token.
 * 4. To show the full web app inside its window, the app asks /api/native/webview-code for a one-time code and loads
 *    /api/native/session?code=…, which sets the usual session cookie for that web view.
 *
 * Tokens and codes are random; only their SHA-256 hashes are stored. Codes live five minutes and work once.
 */
import { createHash } from "node:crypto";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db, deviceTokens, nativeCodes, users, type DevicePlatform, type User } from "@/db";
import { randomId } from "./crypto";

export const PLATFORMS: DevicePlatform[] = ["macos", "windows", "linux", "ios", "android"];
export const PLATFORM_LABEL: Record<DevicePlatform, string> = { macos: "Mac", windows: "Windows", linux: "Linux", ios: "iPhone", android: "Android" };
const CODE_TTL_MS = 5 * 60_000;
const TOUCH_EVERY_MS = 10 * 60_000;
export const MAX_DEVICES = 20;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

export function parsePlatform(v: unknown): DevicePlatform | null {
  return typeof v === "string" && (PLATFORMS as string[]).includes(v) ? (v as DevicePlatform) : null;
}

export async function createCode(kind: "connect" | "webview", userId: number, platform: DevicePlatform, name = ""): Promise<string> {
  const code = randomId(32);
  await db.delete(nativeCodes).where(lt(nativeCodes.expiresAt, new Date()));
  await db.insert(nativeCodes).values({ codeHash: hash(code), kind, userId, platform, name: name.slice(0, 80), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  return code;
}

/** Use a code once. Returns what it was issued for, or null when it is unknown, expired or of the wrong kind. */
export async function consumeCode(code: string, kind: "connect" | "webview") {
  if (!code || code.length > 100) return null;
  const [row] = await db
    .delete(nativeCodes)
    .where(and(eq(nativeCodes.codeHash, hash(code)), eq(nativeCodes.kind, kind), gt(nativeCodes.expiresAt, new Date())))
    .returning();
  return row ?? null;
}

export async function issueDeviceToken(userId: number, platform: DevicePlatform, name: string): Promise<string | null> {
  const active = await db.select({ id: deviceTokens.id }).from(deviceTokens).where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)));
  if (active.length >= MAX_DEVICES) return null;
  const token = `mdr_${randomId(32)}`;
  await db.insert(deviceTokens).values({ userId, platform, name: name.slice(0, 80), tokenHash: hash(token) });
  return token;
}

/** The user behind an `Authorization: Bearer mdr_…` header, or null. */
export async function deviceUser(req: Request): Promise<{ user: User; deviceId: number; platform: DevicePlatform } | null> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer (mdr_[\w-]{20,80})$/.exec(header.trim());
  if (!m) return null;
  const [row] = await db
    .select({ device: deviceTokens, user: users })
    .from(deviceTokens)
    .innerJoin(users, eq(users.id, deviceTokens.userId))
    .where(and(eq(deviceTokens.tokenHash, hash(m[1])), isNull(deviceTokens.revokedAt)))
    .limit(1);
  if (!row) return null;
  const last = row.device.lastUsedAt?.getTime() ?? 0;
  if (Date.now() - last > TOUCH_EVERY_MS) await db.update(deviceTokens).set({ lastUsedAt: new Date() }).where(eq(deviceTokens.id, row.device.id));
  return { user: row.user, deviceId: row.device.id, platform: row.device.platform };
}

export async function listDevices(userId: number) {
  return db
    .select({ id: deviceTokens.id, platform: deviceTokens.platform, name: deviceTokens.name, createdAt: deviceTokens.createdAt, lastUsedAt: deviceTokens.lastUsedAt })
    .from(deviceTokens)
    .where(and(eq(deviceTokens.userId, userId), isNull(deviceTokens.revokedAt)))
    .orderBy(deviceTokens.createdAt);
}

export async function revokeDevice(userId: number, id: number) {
  await db.update(deviceTokens).set({ revokedAt: new Date() }).where(and(eq(deviceTokens.id, id), eq(deviceTokens.userId, userId)));
}

/** The link the browser hands back to the app. `state` is the app's own value, echoed so it can match the reply. */
export function appLink(code: string, state: string) {
  const q = new URLSearchParams({ code, state });
  return `midore://auth?${q}`;
}
