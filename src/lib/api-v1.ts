/** Helpers for /api/v1, the API the desktop and phone apps (and their widgets) call with a device token. */
import { NextResponse } from "next/server";
import type { User } from "@/db";
import { logError } from "@/lib/log";
import { deviceUser } from "@/lib/native";
import { RateLimitError, rateLimitKey } from "@/lib/rate-limit";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Run a handler for the device's user. 401 without a valid token; a generous per-device rate limit. */
export async function withDevice(req: Request, name: string, fn: (user: User) => Promise<Response>): Promise<Response> {
  const d = await deviceUser(req);
  if (!d) return json({ error: "Signed out. Sign in again from the app." }, 401);
  try {
    await rateLimitKey(`v1:${d.deviceId}`, 240, 60);
    return await fn(d.user);
  } catch (err) {
    if (err instanceof RateLimitError) return json({ error: err.message }, 429);
    logError(`v1 ${name}`, err);
    return json({ error: "Something went wrong. Try again." }, 500);
  }
}
