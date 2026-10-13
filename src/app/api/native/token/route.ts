import { NextResponse, type NextRequest } from "next/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { consumeCode, issueDeviceToken, MAX_DEVICES } from "@/lib/native";
import { RateLimitError, rateLimit } from "@/lib/rate-limit";

/** The app trades its one-time connect code for a device token. */
export async function POST(req: NextRequest) {
  try {
    await rateLimit(req, "nativeToken");
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
    throw err;
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const row = await consumeCode(typeof body.code === "string" ? body.code : "", "connect");
  if (!row) return NextResponse.json({ error: "This sign-in link has expired. Sign in again from the app." }, { status: 400 });
  const token = await issueDeviceToken(row.userId, row.platform, row.name);
  if (!token) return NextResponse.json({ error: `You can connect up to ${MAX_DEVICES} devices. Disconnect one in Settings first.` }, { status: 400 });
  const [user] = await db.select({ name: users.name, email: users.email, username: users.username }).from(users).where(eq(users.id, row.userId));
  return NextResponse.json({ token, user });
}
