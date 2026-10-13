import { NextResponse, type NextRequest } from "next/server";
import { createCode, deviceUser } from "@/lib/native";

/** A one-time code that signs the app's own web view in (see /api/native/session). */
export async function POST(req: NextRequest) {
  const d = await deviceUser(req);
  if (!d) return NextResponse.json({ error: "Signed out" }, { status: 401 });
  return NextResponse.json({ code: await createCode("webview", d.user.id, d.platform) });
}
