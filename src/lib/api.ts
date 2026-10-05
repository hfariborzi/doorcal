import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { BookingError } from "./bookings";
import { CalendarNotConnectedError } from "./calendar";
import { logError } from "./log";
import { RateLimitError } from "./rate-limit";

export function apiError(err: unknown) {
  if (err instanceof RateLimitError) return NextResponse.json({ error: err.message }, { status: 429 });
  if (err instanceof BookingError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof CalendarNotConnectedError)
    return NextResponse.json({ error: "This calendar is temporarily unavailable for booking." }, { status: 503 });
  if (err instanceof ZodError)
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  logError("api", err);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}
