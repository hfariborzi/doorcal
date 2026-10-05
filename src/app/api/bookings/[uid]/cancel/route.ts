import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { cancelBooking } from "@/lib/bookings";
import { apiError } from "@/lib/api";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/bookings/[uid]/cancel">) {
  try {
    const { uid } = await ctx.params;
    const { reason } = z.object({ reason: z.string().max(2000).default("") }).parse(await req.json());
    await cancelBooking(uid, "invitee", reason);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
