import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { oauthClient } from "@/lib/google";
import { encrypt } from "@/lib/crypto";
import { signSession, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { ensureDefaults } from "@/lib/data";
import { RESERVED_USERNAMES, hasCalendarScopes } from "@/lib/config";

function isAllowed(email: string) {
  const emails = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const domains = (process.env.ALLOWED_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!emails.length && !domains.length) return true; // open sign-up
  const e = email.toLowerCase();
  return emails.includes(e) || domains.some((d) => e.endsWith(`@${d}`));
}

async function uniqueUsername(email: string) {
  const base =
    email
      .split("@")[0]
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "user";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    if (RESERVED_USERNAMES.has(candidate)) continue;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.username, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

function validTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return !!tz;
  } catch {
    return false;
  }
}

function failRedirect(req: NextRequest, msg: string) {
  return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(msg)}`, req.url));
}

export async function GET(req: NextRequest) {
  try {
    return await handleCallback(req);
  } catch (err) {
    // e.g. an expired or already-used code, or a database error
    console.error("[oauth callback]", err);
    return failRedirect(req, "Sign-in failed. Please try again.");
  }
}

async function handleCallback(req: NextRequest) {
  const fail = (msg: string) => failRedirect(req, msg);
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return fail("Google sign-in was cancelled.");

  let stored: { state?: string; tz?: string } = {};
  try {
    stored = JSON.parse(req.cookies.get("oauth_state")?.value ?? "{}");
  } catch {}
  if (!stored.state || stored.state !== params.get("state")) return fail("Sign-in expired. Please try again.");

  const client = oauthClient(req.nextUrl.origin);
  const { tokens } = await client.getToken(params.get("code") ?? "");
  if (!tokens.id_token) return fail("Google did not return an identity token.");
  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p?.sub || !p.email || !p.email_verified) return fail("Your Google account email is not verified.");
  if (!isAllowed(p.email)) return fail("This account is not allowed to sign in on this site.");

  const scopes = tokens.scope ?? "";
  const hasCalendar = hasCalendarScopes(scopes);
  const refresh = tokens.refresh_token && hasCalendar ? encrypt(tokens.refresh_token) : undefined;

  let [user] = await db.select().from(users).where(eq(users.googleSub, p.sub)).limit(1);
  if (user) {
    [user] = await db
      .update(users)
      .set({
        email: p.email,
        image: p.picture ?? user.image,
        name: user.name || p.name || "",
        ...(refresh ? { googleRefreshToken: refresh, googleScopes: scopes } : {}),
      })
      .where(eq(users.id, user.id))
      .returning();
  } else {
    [user] = await db
      .insert(users)
      .values({
        googleSub: p.sub,
        email: p.email,
        name: p.name ?? "",
        image: p.picture ?? null,
        username: await uniqueUsername(p.email),
        timezone: stored.tz && validTimezone(stored.tz) ? stored.tz : "UTC",
        googleRefreshToken: refresh ?? null,
        googleScopes: refresh ? scopes : null,
      })
      .returning();
  }

  await ensureDefaults(user);

  const res = NextResponse.redirect(
    new URL(user.googleRefreshToken ? "/dashboard" : "/dashboard?connect=1", req.url),
  );
  res.cookies.delete("oauth_state");
  res.cookies.set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);

  // Google only returns a refresh token on first consent. If we don't have one, ask again with consent.
  if (!user.googleRefreshToken && hasCalendar) {
    res.headers.set("Location", new URL("/api/auth/google?reconnect=1", req.url).toString());
  }
  return res;
}
