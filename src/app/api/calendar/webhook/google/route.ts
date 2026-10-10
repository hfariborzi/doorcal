import { NextResponse, type NextRequest } from "next/server";
import { noteCalendarChange } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";

/**
 * Google Calendar push notifications. The body is empty; the headers say which channel changed. The first
 * message on a new channel ("sync") carries no change. Always answer 200 so Google does not retry forever.
 */
export async function POST(req: NextRequest) {
  try {
    const state = req.headers.get("x-goog-resource-state");
    const channelId = req.headers.get("x-goog-channel-id");
    if (channelId && state && state !== "sync") await noteCalendarChange(channelId, req.headers.get("x-goog-channel-token"));
  } catch (err) {
    logError("google webhook", err);
  }
  return new NextResponse(null, { status: 200 });
}
