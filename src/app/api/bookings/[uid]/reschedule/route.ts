import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rescheduleBooking } from "@/lib/bookings";
import { apiError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest, ctx: RouteContext<"/api/bookings/[uid]/reschedule">) {
  try {
    await rateLimit(req, "manage");
    const { uid } = await ctx.params;
    const { start, timezone } = z.object({ start: z.string(), timezone: z.string().max(64) }).parse(await req.json());
    const booking = await rescheduleBooking(uid, start, timezone);
    return NextResponse.json({ uid: booking.uid });
  } catch (err) {
    return apiError(err);
  }
}
