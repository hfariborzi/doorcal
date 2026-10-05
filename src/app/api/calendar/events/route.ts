import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, bookings } from "@/db";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/bookings";
import { eventsForAccounts, getAccount, listAccounts, providerFor, resolveWriteTarget } from "@/lib/calendar";
import { randomId } from "@/lib/crypto";

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

const MAX_RANGE_MS = 62 * 86_400_000;

export async function GET(req: NextRequest) {
  try {
    const user = await authed();
    const start = new Date(req.nextUrl.searchParams.get("start") ?? "");
    const end = new Date(req.nextUrl.searchParams.get("end") ?? "");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || end.getTime() - start.getTime() > MAX_RANGE_MS)
      return NextResponse.json({ error: "Invalid range" }, { status: 400 });
    const result = await eventsForAccounts(user, await listAccounts(user.id), start, end);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
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
  locationType: z.enum(["online", "in_person", "phone", "custom_link", "none"]),
  locationValue: z.string().max(1000).default(""),
  // Which calendar to write to; omitted means the user's default.
  accountId: z.number().int().optional(),
  calendarId: z.string().min(1).max(300).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await authed();
    const b = createSchema.parse(await req.json());
    const start = new Date(b.start);
    const end = new Date(b.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start)
      return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
    if (end.getTime() - start.getTime() > 14 * 86_400_000)
      return NextResponse.json({ error: "Meetings can't be longer than two weeks." }, { status: 400 });

    let target;
    if (b.accountId !== undefined) {
      const account = await getAccount(user.id, b.accountId);
      if (!account) return NextResponse.json({ error: "Unknown calendar account" }, { status: 400 });
      target = { account, calendarId: b.calendarId || "primary" };
    } else {
      target = resolveWriteTarget(user, await listAccounts(user.id));
    }
    const location =
      b.locationType === "online" || b.locationType === "none"
        ? undefined
        : b.locationType === "phone"
          ? `Phone: ${b.locationValue}`
          : b.locationValue || undefined;
    const ev = await providerFor(target.account).createEvent(target.account, target.calendarId, {
      requestId: randomId(),
      summary: b.title,
      description: b.description || undefined,
      location,
      start,
      end,
      timeZone: b.timezone,
      attendees: b.attendees.map((email) => ({ email })),
      onlineMeeting: b.locationType === "online",
    });
    return NextResponse.json(ev);
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authed();
    const q = req.nextUrl.searchParams;
    const accountId = Number(q.get("accountId"));
    const calendarId = q.get("calendarId");
    const eventId = q.get("eventId");
    if (!accountId || !calendarId || !eventId) return NextResponse.json({ error: "Missing event" }, { status: 400 });
    const account = await getAccount(user.id, accountId);
    if (!account) return NextResponse.json({ error: "Unknown calendar account" }, { status: 400 });
    // If this event came from a booking, cancel the booking(s) too so the slot frees up.
    const linked = await db
      .select({ uid: bookings.uid })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.accountId, account.id), eq(bookings.eventId, eventId), eq(bookings.status, "confirmed")));
    if (linked.length) {
      for (const b of linked) await cancelBooking(b.uid, "host", "");
    } else {
      await providerFor(account).deleteEvent(account, calendarId, eventId);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
