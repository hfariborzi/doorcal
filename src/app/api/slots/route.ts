import { NextResponse, type NextRequest } from "next/server";
import { getEventType, getSlots, getUserByUsername } from "@/lib/data";
import { getBookingByUid } from "@/lib/bookings";
import { apiError } from "@/lib/api";

const MAX_RANGE_MS = 45 * 86_400_000;

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const user = await getUserByUsername(q.get("user") ?? "");
    const et = user ? await getEventType(user.id, q.get("type") ?? "") : null;
    if (!user || !et || !et.active) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const duration = Number(q.get("duration")) || et.durations[0];
    if (!et.durations.includes(duration)) return NextResponse.json({ error: "Invalid duration" }, { status: 400 });
    const start = new Date(q.get("start") ?? "");
    const end = new Date(q.get("end") ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > MAX_RANGE_MS)
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });

    let ignore: string | undefined;
    const reschedule = q.get("reschedule");
    if (reschedule) {
      const row = await getBookingByUid(reschedule);
      if (row && row.booking.userId === user.id) ignore = row.booking.uid;
    }

    const { slots, schedule } = await getSlots({
      user,
      eventType: et,
      duration,
      rangeStart: start,
      rangeEnd: end,
      ignoreBookingUid: ignore,
    });
    return NextResponse.json({ slots, hostTimezone: schedule.timezone }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return apiError(err);
  }
}
