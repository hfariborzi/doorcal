/**
 * Sign-in and "connect another account" flows for every provider.
 *
 * Security notes:
 * - The flow state lives in a signed, 10-minute cookie: the CSRF `state`, the OpenID `nonce`, the PKCE
 *   verifier, the mode (sign-in or connect) and, for connect, the id of the user who started it.
 * - Accounts are matched only by the provider's stable account id, never by email address, so an attacker
 *   who controls an account with a victim's email elsewhere can't take over the victim's DoorCal account.
 * - Connecting an account to an existing user requires a live session that matches the user baked into the
 *   state cookie, and a provider account can belong to only one DoorCal account (unique index).
 */
import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db, calendarAccounts, users, type Provider } from "@/db";
import { authFor, isConnected, listAccounts } from "./calendar";
import type { ProviderIdentity } from "./calendar";
import { RESERVED_USERNAMES } from "./config";
import { encrypt, randomId } from "./crypto";
import { ensureDefaults } from "./data";
import { logError } from "./log";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

const STATE_COOKIE = "oauth";
const STATE_TTL_SEC = 600;

type FlowState = {
  provider: Provider;
  mode: "signin" | "connect";
  uid?: number; // connect mode: the signed-in user
  state: string;
  nonce: string;
  verifier: string;
  tz?: string;
  reconnect?: number; // connect mode: the account being reconnected
};

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

async function signState(f: FlowState) {
  return new SignJWT(f as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_SEC}s`)
    .sign(secret());
}

async function readState(token: string | undefined): Promise<FlowState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as FlowState;
  } catch {
    return null;
  }
}

function allowList() {
  const emails = (process.env.ALLOWED_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const domains = (process.env.ALLOWED_DOMAINS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return { emails, domains, open: !emails.length && !domains.length };
}

/**
 * With an allow-list configured, the address must be one the provider vouches for: a Microsoft tenant can put
 * any address in the email claim, so an unverified claim could otherwise impersonate an allowed domain.
 */
function isAllowed(identity: ProviderIdentity) {
  const { emails, domains, open } = allowList();
  if (open) return true;
  if (!identity.emailVerified) return false;
  const e = identity.email.toLowerCase();
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

const sessionUser = (req: NextRequest) => verifySession(req.cookies.get(SESSION_COOKIE)?.value);

/** GET /api/auth/[provider]: send the browser to the provider's consent screen. */
export async function startOAuth(req: NextRequest, provider: Provider) {
  const auth = authFor(provider);
  if (!auth.enabled()) return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent("That sign-in method is not available."), req.url));

  const q = req.nextUrl.searchParams;
  const uid = await sessionUser(req);
  const reconnect = Number(q.get("reconnect")) || undefined;
  const connecting = q.get("connect") === "1" || !!reconnect;
  if (connecting && !uid) return NextResponse.redirect(new URL("/login", req.url));

  let loginHint: string | undefined;
  if (reconnect && uid) {
    const [acc] = await db
      .select({ email: calendarAccounts.email, provider: calendarAccounts.provider })
      .from(calendarAccounts)
      .where(and(eq(calendarAccounts.id, reconnect), eq(calendarAccounts.userId, uid)));
    if (!acc || acc.provider !== provider) return NextResponse.redirect(new URL("/dashboard/settings", req.url));
    loginHint = acc.email;
  }

  const verifier = randomId(48);
  const flow: FlowState = {
    provider,
    mode: connecting ? "connect" : "signin",
    uid: connecting ? uid! : undefined,
    state: randomId(24),
    nonce: randomId(24),
    verifier,
    tz: q.get("tz") ?? undefined,
    reconnect,
  };
  const url = auth.authUrl({
    state: flow.state,
    nonce: flow.nonce,
    codeChallenge: createHash("sha256").update(verifier).digest("base64url"),
    origin: req.nextUrl.origin,
    // Connecting always asks for full consent so the provider issues a refresh token we can keep.
    forceConsent: connecting || q.get("consent") === "1",
    loginHint,
  });
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, await signState(flow), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SEC,
  });
  return res;
}

/** GET /api/auth/[provider]/callback: finish the flow started above. */
export async function finishOAuth(req: NextRequest, provider: Provider) {
  const flow = await readState(req.cookies.get(STATE_COOKIE)?.value);
  const connect = flow?.mode === "connect";
  const fail = (msg: string) => {
    const path = connect ? "/dashboard/settings" : "/login";
    const res = NextResponse.redirect(new URL(`${path}?error=${encodeURIComponent(msg)}`, req.url));
    res.cookies.delete(STATE_COOKIE);
    return res;
  };
  try {
    const params = req.nextUrl.searchParams;
    if (params.get("error")) return fail(connect ? "Connecting was cancelled." : "Sign-in was cancelled.");
    if (!flow || flow.provider !== provider || flow.state !== params.get("state")) return fail("Sign-in expired. Please try again.");
    const code = params.get("code");
    if (!code) return fail("The provider did not return a sign-in code.");

    const identity = await authFor(provider).exchangeCode(code, flow.verifier, flow.nonce, req.nextUrl.origin);
    if (provider === "google" && !identity.emailVerified) return fail("Your Google account email is not verified.");
    if (!isAllowed(identity)) return fail("This account is not allowed to sign in on this site.");

    return connect ? await finishConnect(req, flow, identity, fail) : await finishSignIn(req, flow, identity);
  } catch (err) {
    logError(`oauth ${provider} callback`, err);
    return fail(connect ? "Connecting the account failed. Please try again." : "Sign-in failed. Please try again.");
  }
}

type Fail = (msg: string) => NextResponse;

function tokenUpdate(identity: ProviderIdentity) {
  return identity.refreshToken && identity.hasCalendarScopes
    ? { refreshToken: encrypt(identity.refreshToken), scopes: identity.scopes, onlineMeetings: identity.onlineMeetings }
    : {};
}

async function finishSignIn(req: NextRequest, flow: FlowState, identity: ProviderIdentity) {
  const [existing] = await db
    .select()
    .from(calendarAccounts)
    .where(and(eq(calendarAccounts.provider, flow.provider), eq(calendarAccounts.providerAccountId, identity.providerAccountId)))
    .limit(1);

  let userId: number;
  let accountId: number;
  let needsToken: boolean;
  if (existing) {
    const [acc] = await db
      .update(calendarAccounts)
      .set({ email: identity.email, name: identity.name || existing.name, ...tokenUpdate(identity) })
      .where(eq(calendarAccounts.id, existing.id))
      .returning();
    userId = acc.userId;
    accountId = acc.id;
    needsToken = !isConnected(acc);
    if (identity.picture) await db.update(users).set({ image: identity.picture }).where(eq(users.id, userId));
  } else {
    const [user] = await db
      .insert(users)
      .values({
        email: identity.email,
        name: identity.name,
        image: identity.picture,
        username: await uniqueUsername(identity.email),
        timezone: flow.tz && validTimezone(flow.tz) ? flow.tz : "UTC",
      })
      .returning();
    const [acc] = await db
      .insert(calendarAccounts)
      .values({
        userId: user.id,
        provider: flow.provider,
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        name: identity.name,
        ...tokenUpdate(identity),
      })
      .returning();
    await db.update(users).set({ writeAccountId: acc.id }).where(eq(users.id, user.id));
    await ensureDefaults(user);
    userId = user.id;
    accountId = acc.id;
    needsToken = !isConnected(acc);
  }

  // Providers only issue a refresh token on full consent. If we still have none but the calendar scopes were
  // granted, go straight back through consent for this account; otherwise the dashboard asks to connect.
  const next = needsToken && identity.hasCalendarScopes ? `/api/auth/${flow.provider}?reconnect=${accountId}` : "/dashboard";
  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.delete(STATE_COOKIE);
  res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
  return res;
}

async function finishConnect(req: NextRequest, flow: FlowState, identity: ProviderIdentity, fail: Fail) {
  const uid = await sessionUser(req);
  if (!uid || uid !== flow.uid) return fail("Your session changed. Please sign in and try again.");

  const [existing] = await db
    .select()
    .from(calendarAccounts)
    .where(and(eq(calendarAccounts.provider, flow.provider), eq(calendarAccounts.providerAccountId, identity.providerAccountId)))
    .limit(1);
  if (existing && existing.userId !== uid) return fail(`${identity.email} is already connected to a different DoorCal account.`);
  if (!identity.hasCalendarScopes || !identity.refreshToken) return fail("Calendar access was not granted. Please allow all calendar permissions and try again.");

  if (existing) {
    await db
      .update(calendarAccounts)
      .set({ email: identity.email, name: identity.name || existing.name, ...tokenUpdate(identity) })
      .where(eq(calendarAccounts.id, existing.id));
  } else {
    await db.insert(calendarAccounts).values({
      userId: uid,
      provider: flow.provider,
      providerAccountId: identity.providerAccountId,
      email: identity.email,
      name: identity.name,
      ...tokenUpdate(identity),
    });
  }
  // A user whose default booking account went missing gets this one.
  const [user] = await db.select({ writeAccountId: users.writeAccountId }).from(users).where(eq(users.id, uid));
  const accounts = await listAccounts(uid);
  if (!accounts.some((a) => a.id === user.writeAccountId)) {
    const first = accounts.find(isConnected);
    if (first) await db.update(users).set({ writeAccountId: first.id, writeCalendarId: "primary" }).where(eq(users.id, uid));
  }
  const res = NextResponse.redirect(new URL("/dashboard/settings?connected=1", req.url));
  res.cookies.delete(STATE_COOKIE);
  return res;
}
