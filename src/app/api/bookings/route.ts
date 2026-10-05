import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEventType, getUserByUsername } from "@/lib/data";
import { createBooking } from "@/lib/bookings";
import { apiError } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";

const schema = z.object({
  user: z.string(),
  type: z.string(),
  start: z.string(),
  duration: z.number().int().positive(),
  timezone: z.string().max(64),
  name: z.string().trim().min(1, "Please enter your name.").max(200),
  email: z.string().trim().email("Please enter a valid email."),
  guests: z.array(z.string().trim().email("One of the guest emails is invalid.")).max(10).default([]),
  notes: z.string().max(5000).default(""),
  answers: z.record(z.string(), z.string().max(5000)).default({}),
  locationIndex: z.number().int().min(0).default(0),
  phone: z.string().max(40).optional(),
  website: z.string().optional(), // honeypot
});

export async function POST(req: NextRequest) {
  try {
    await rateLimit(req, "book");
    const body = schema.parse(await req.json());
    if (body.website) return NextResponse.json({ error: "Rejected" }, { status: 400 });
    const user = await getUserByUsername(body.user);
    const et = user ? await getEventType(user.id, body.type) : null;
    if (!user || !et || !et.active) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const booking = await createBooking(user, et, body);
    return NextResponse.json({ uid: booking.uid });
  } catch (err) {
    return apiError(err);
  }
}
