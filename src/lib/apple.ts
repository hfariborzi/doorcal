/**
 * Sign in with Apple on the web (also used by the iPhone app, inside its sign-in sheet).
 *
 * Apple identifies the person but gives no calendar access, so an Apple sign-in is a login identity
 * (`login_identities`), not a calendar account: new users connect a Google or Microsoft calendar afterwards, and
 * existing users can link Apple from Settings so it signs them in to the same account.
 *
 * Flow: GET /api/auth/apple → Apple's consent page → Apple POSTs the result to /api/auth/apple/callback
 * (`response_mode=form_post`, required when asking for name and email). Because that POST comes from
 * appleid.apple.com, the flow cookie is SameSite=None; it is signed, httpOnly and lives 10 minutes.
 *
 * Env: APPLE_TEAM_ID, APPLE_SERVICES_ID (the Services ID used as client_id), APPLE_KEY_ID, APPLE_PRIVATE_KEY
 * (the .p8 key with "Sign in with Apple" enabled; newlines may be written as \n).
 */
import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from "jose";
import { logError } from "./log";

const ISSUER = "https://appleid.apple.com";
const JWKS = createRemoteJWKSet(new URL(`${ISSUER}/auth/keys`));

export function appleEnabled() {
  return !!(process.env.APPLE_TEAM_ID && process.env.APPLE_SERVICES_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}

const servicesId = () => process.env.APPLE_SERVICES_ID!;
export const appleRedirectUri = (origin: string) => `${origin}/api/auth/apple/callback`;

/** Apple's client secret is a short-lived JWT signed with the team's key. */
async function clientSecret() {
  const pem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(servicesId())
    .setAudience(ISSUER)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(key);
}

export function appleAuthUrl({ state, nonce, origin }: { state: string; nonce: string; origin: string }) {
  const url = new URL(`${ISSUER}/auth/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("client_id", servicesId());
  url.searchParams.set("redirect_uri", appleRedirectUri(origin));
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  return url.toString();
}

export type AppleIdentity = {
  subject: string;
  email: string;
  emailVerified: boolean;
  privateEmail: boolean;
  refreshToken: string | null;
};

const truthy = (v: unknown) => v === true || v === "true";

/** Exchange the authorization code and verify the ID token (Apple's keys, our client, the flow's nonce). */
export async function appleExchange(code: string, origin: string, nonce: string): Promise<AppleIdentity> {
  const res = await fetch(`${ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: servicesId(),
      client_secret: await clientSecret(),
      code,
      grant_type: "authorization_code",
      redirect_uri: appleRedirectUri(origin),
    }),
  });
  if (!res.ok) throw new Error(`Apple token exchange failed (${res.status}): ${await res.text().catch(() => "")}`);
  const body = (await res.json()) as { id_token?: string; refresh_token?: string };
  if (!body.id_token) throw new Error("Apple returned no ID token");
  const { payload } = await jwtVerify(body.id_token, JWKS, { issuer: ISSUER, audience: servicesId() });
  if (payload.nonce !== nonce) throw new Error("Apple ID token nonce mismatch");
  if (!payload.sub) throw new Error("Apple ID token has no subject");
  return {
    subject: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    emailVerified: truthy(payload.email_verified),
    privateEmail: truthy(payload.is_private_email),
    refreshToken: body.refresh_token ?? null,
  };
}

/** Revoke Midore's access at Apple (account deletion or unlinking). Failures are logged, not thrown. */
export async function appleRevoke(refreshToken: string) {
  if (!appleEnabled()) return;
  try {
    const res = await fetch(`${ISSUER}/auth/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: servicesId(),
        client_secret: await clientSecret(),
        token: refreshToken,
        token_type_hint: "refresh_token",
      }),
    });
    if (!res.ok) logError("apple revoke", new Error(`HTTP ${res.status}`));
  } catch (err) {
    logError("apple revoke", err);
  }
}

/** The name Apple sends in the `user` form field, only on the first authorization. */
export function appleName(userField: FormDataEntryValue | null): string {
  if (typeof userField !== "string") return "";
  try {
    const u = JSON.parse(userField) as { name?: { firstName?: string; lastName?: string } };
    return [u.name?.firstName, u.name?.lastName].filter(Boolean).join(" ").trim().slice(0, 100);
  } catch {
    return "";
  }
}
