import { NextResponse, type NextRequest } from "next/server";
import { isProvider } from "@/lib/calendar";
import { finishOAuth } from "@/lib/oauth";

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/[provider]/callback">) {
  const { provider } = await ctx.params;
  if (!isProvider(provider)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return finishOAuth(req, provider);
}
