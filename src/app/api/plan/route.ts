import { NextResponse, after, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatches } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";
import { planBlocks } from "@/lib/plan-view";

// Recomputing the plan reads free/busy from every connected calendar.
export const maxDuration = 30;

/** Planned work blocks in a range, with task titles and states, for the calendar view. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const start = Date.parse(req.nextUrl.searchParams.get("start") ?? "");
  const end = Date.parse(req.nextUrl.searchParams.get("end") ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  try {
    const blocks = await planBlocks(user, start, end);
    after(() => ensureWatches(user.id).catch((err) => logError("watches", err)));
    return NextResponse.json({ blocks }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    logError("plan", err);
    return NextResponse.json({ error: "Could not load the plan" }, { status: 500 });
  }
}
