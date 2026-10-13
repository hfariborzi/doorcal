import { NextResponse, type NextRequest } from "next/server";
import { consumeCode } from "@/lib/native";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

/** The app's web view opens this once with a webview code; it gets the usual session cookie and the dashboard. */
export async function GET(req: NextRequest) {
  const row = await consumeCode(req.nextUrl.searchParams.get("code") ?? "", "webview");
  if (!row) return NextResponse.redirect(new URL("/login", req.url));
  const res = NextResponse.redirect(new URL("/dashboard", req.url));
  res.cookies.set(SESSION_COOKIE, await signSession(row.userId), sessionCookieOptions);
  return res;
}
