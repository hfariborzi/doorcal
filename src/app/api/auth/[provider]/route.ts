import { NextResponse, type NextRequest } from "next/server";
import { isProvider } from "@/lib/calendar";
import { startOAuth } from "@/lib/oauth";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[provider]">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return startOAuth(req, provider);
}
