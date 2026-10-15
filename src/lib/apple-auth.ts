/**
 * The Sign in with Apple routes: start (GET /api/auth/apple) and finish (POST /api/auth/apple/callback).
 * See lib/apple.ts for the protocol. Same rules as lib/oauth.ts: identities are matched only by Apple's stable
 * user id, never by email, and linking to an existing account needs a live session for that account.
 */
import { NextResponse, type NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";
import { db, loginIdentities, users } from "@/db";
import { appleAuthUrl, appleEnabled, appleExchange, appleName } from "./apple";
import { encrypt, randomId } from "./crypto";
import { ensureDefaults } from "./data";
import { logError } from "./log";
import { isAllowed, safeNext, uniqueUsername, validTimezone } from "./oauth";
import { SESSION_COOKIE, sessionCookieOptions, signSession, verifySession } from "./session";

const FLOW_COOKIE = "apple_oauth";
const FLOW_TTL_SEC = 600;

type AppleFlow = {
  typ: "apple";
  mode: "signin" | "link";
  uid?: number; // link mode: the signed-in user
  state: string;
  nonce: string;
  tz?: string;
  next?: string;
};

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
};

async function readFlow(token: string | undefined): Promise<AppleFlow | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.typ === "apple" ? (payload as unknown as AppleFlow) : null;
  } catch {
    return null;
  }
}

/** 303 so the browser follows Apple's POST with a GET. */
const go = (path: string, req: NextRequest) => NextResponse.redirect(new URL(path, req.url), 303);

/** GET /api/auth/apple: send the browser to Apple. `?link=1` links Apple to the signed-in account. */
export async function startApple(req: NextRequest) {
  if (!appleEnabled()) return go("/login?error=" + encodeURIComponent("That sign-in method is not available."), req);
  const q = req.nextUrl.searchParams;
  const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const linking = q.get("link") === "1";
  if (linking && !uid) return go("/login", req);

  const flow: AppleFlow = {
    typ: "apple",
    mode: linking ? "link" : "signin",
    uid: linking ? uid! : undefined,
    state: randomId(24),
    nonce: randomId(24),
    tz: q.get("tz") ?? undefined,
    next: linking ? undefined : safeNext(q.get("next")),
  };
  const res = NextResponse.redirect(appleAuthUrl({ state: flow.state, nonce: flow.nonce, origin: req.nextUrl.origin }));
  res.cookies.set(FLOW_COOKIE, await new SignJWT(flow as unknown as Record<string, unknown>).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(`${FLOW_TTL_SEC}s`).sign(secret()), {
    httpOnly: true,
    secure: true,
    // Apple answers with a cross-site form POST, which doesn't carry Lax cookies.
    sameSite: "none",
    path: "/api/auth/apple",
    maxAge: FLOW_TTL_SEC,
  });
  return res;
}

/** POST /api/auth/apple/callback: Apple's form post with `code`, `state` and, the first time, `user`. */
export async function finishApple(req: NextRequest) {
  const flow = await readFlow(req.cookies.get(FLOW_COOKIE)?.value);
  const linking = flow?.mode === "link";
  const fail = (msg: string) => {
    const res = go(`${linking ? "/dashboard/settings" : "/login"}?error=${encodeURIComponent(msg)}`, req);
    res.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/apple" });
    return res;
  };
  try {
    const form = await req.formData();
    if (form.get("error")) return fail(linking ? "Linking Apple was cancelled." : "Sign-in was cancelled.");
    if (!flow || flow.state !== form.get("state")) return fail("Sign-in expired. Please try again.");
    const code = form.get("code");
    if (typeof code !== "string" || !code) return fail("Apple did not return a sign-in code.");

    const identity = await appleExchange(code, req.nextUrl.origin, flow.nonce);
    if (!isAllowed(identity)) return fail("This account is not allowed to sign in on this site.");
    const tokenFields = identity.refreshToken ? { refreshToken: encrypt(identity.refreshToken) } : {};
    const [existing] = await db
      .select()
      .from(loginIdentities)
      .where(and(eq(loginIdentities.provider, "apple"), eq(loginIdentities.subject, identity.subject)))
      .limit(1);

    if (linking) {
      const uid = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
      if (!uid || uid !== flow.uid) return fail("Your session changed. Please sign in and try again.");
      if (existing && existing.userId !== uid) return fail("That Apple ID already signs in to a different Midore account.");
      if (existing) {
        await db.update(loginIdentities).set({ email: identity.email || existing.email, privateEmail: identity.privateEmail, ...tokenFields }).where(eq(loginIdentities.id, existing.id));
      } else {
        await db.insert(loginIdentities).values({ userId: uid, provider: "apple", subject: identity.subject, email: identity.email, privateEmail: identity.privateEmail, ...tokenFields });
      }
      const res = go("/dashboard/settings?linked=apple", req);
      res.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/apple" });
      return res;
    }

    let userId: number;
    if (existing) {
      await db.update(loginIdentities).set({ email: identity.email || existing.email, privateEmail: identity.privateEmail, ...tokenFields }).where(eq(loginIdentities.id, existing.id));
      userId = existing.userId;
    } else {
      const name = appleName(form.get("user"));
      // A private relay address makes a meaningless username; the name (sent only now) is nicer.
      const usernameFrom = identity.privateEmail && name ? `${name}@apple` : identity.email || "me";
      const [user] = await db
        .insert(users)
        .values({
          email: identity.email,
          name,
          username: await uniqueUsername(usernameFrom),
          timezone: flow.tz && validTimezone(flow.tz) ? flow.tz : "UTC",
        })
        .returning();
      await db.insert(loginIdentities).values({ userId: user.id, provider: "apple", subject: identity.subject, email: identity.email, privateEmail: identity.privateEmail, ...tokenFields });
      await ensureDefaults(user);
      userId = user.id;
    }
    // New Apple users have no calendar yet; the dashboard asks them to connect one.
    const res = go(safeNext(flow.next) ?? "/dashboard", req);
    res.cookies.delete({ name: FLOW_COOKIE, path: "/api/auth/apple" });
    res.cookies.set(SESSION_COOKIE, await signSession(userId), sessionCookieOptions);
    return res;
  } catch (err) {
    logError("apple callback", err);
    return fail(linking ? "Linking Apple failed. Please try again." : "Sign-in failed. Please try again.");
  }
}
