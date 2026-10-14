import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { appLink, createCode, parsePlatform } from "@/lib/native";

/** The "Connect" button on /native/connect: issue a one-time code for the app and hand it over. */
export async function POST(req: NextRequest) {
  // Only our own connect page may post here (the session cookie is SameSite=Lax as well).
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return new NextResponse("Forbidden", { status: 403 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url), 303);
  const form = await req.formData();
  const platform = parsePlatform(form.get("platform"));
  const state = String(form.get("state") ?? "");
  if (!platform || !/^[\w-]{8,64}$/.test(state)) return NextResponse.redirect(new URL("/native/connect", req.url), 303);
  const code = await createCode("connect", user.id, platform, String(form.get("name") ?? ""));
  // Phones sign in inside an in-app browser sheet, which closes as soon as it reaches the midore:// link.
  if (platform === "ios" || platform === "android") return NextResponse.redirect(appLink(code, state), 303);
  const done = new URL("/native/connect/done", req.url);
  done.searchParams.set("link", appLink(code, state));
  return NextResponse.redirect(done, 303);
}
