import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createEvent, deleteEvent, listEvents } from "@/lib/google";
import { randomId } from "@/lib/crypto";
import { apiError } from "@/lib/api";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { cancelBooking } from "@/lib/bookings";

async function authed() {
  const user = await getCurrentUser();
  if (!user) throw Object.assign(new Error("Unauthorized"), { unauthorized: true });
  return user;
}

function handle(err: unknown) {
  if ((err as { unauthorized?: boolean })?.unauthorized)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return apiError(err);
}

export async function GET(req: NextRequest) {
  try {
    const user = await authed();
    const start = new Date(req.nextUrl.searchParams.get("start") ?? "");
    const end = new Date(req.nextUrl.searchParams.get("end") ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    const events = await listEvents(user, start, end);
    return NextResponse.json({ events }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handle(err);
  }
}

const createSchema = z.object({
  title: z.string().trim().min(1, "Please add a title.").max(300),
  start: z.string(),
  end: z.string(),
  timezone: z.string().max(64),
  attendees: z.array(z.string().trim().email("One of the attendee emails is invalid.")).max(100).default([]),
  description: z.string().max(10000).default(""),
  locationType: z.enum(["google_meet", "in_person", "phone", "custom_link", "none"]),
  locationValue: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  try {
    const user = await authed();
    const b = createSchema.parse(await req.json());
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    const location =
      b.locationType === "google_meet" || b.locationType === "none"
        ? undefined
        : b.locationType === "phone"
          ? `Phone: ${b.locationValue}`
          : b.locationValue || undefined;
    const ev = await createEvent(user, {
      calendarId: user.writeCalendarId,
      requestId: randomId(),
      summary: b.title,
      description: b.description || undefined,
      location,
      start,
      end,
      timeZone: b.timezone,
      attendees: b.attendees.map((email) => ({ email })),
      googleMeet: b.locationType === "google_meet",
    });
    return NextResponse.json(ev);
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authed();
    const calendarId = req.nextUrl.searchParams.get("calendarId");
    const eventId = req.nextUrl.searchParams.get("eventId");
    if (!calendarId || !eventId) return NextResponse.json({ error: "Missing event" }, { status: 400 });
    // If this event came from a booking, cancel the booking(s) too so the slot frees up.
    const linked = await db
      .select({ uid: bookings.uid })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.googleEventId, eventId), eq(bookings.status, "confirmed")));
    if (linked.length) {
      for (const b of linked) await cancelBooking(b.uid, "host", "");
    } else {
      await deleteEvent(user, calendarId, eventId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
