import { NextResponse, type NextRequest } from "next/server";
import { authUrl } from "@/lib/google";
import { randomId } from "@/lib/crypto";

export async function GET(req: NextRequest) {
  const reconnect = req.nextUrl.searchParams.get("reconnect") === "1";
  const tz = req.nextUrl.searchParams.get("tz") ?? "";
  const state = randomId(16);
  const res = NextResponse.redirect(authUrl(state, reconnect, req.nextUrl.origin));
  res.cookies.set("oauth_state", JSON.stringify({ state, tz }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
