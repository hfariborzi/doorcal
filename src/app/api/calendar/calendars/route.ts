import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { calendarsForAccounts, isConnected, listAccounts, writeTargets } from "@/lib/calendar";

/** Calendars the signed-in user can create events on, across all connected accounts (for the quick-create form). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const accounts = (await listAccounts(user.id)).filter(isConnected);
    const targets = writeTargets(await calendarsForAccounts(accounts));
    return NextResponse.json(
      { targets, default: { accountId: user.writeAccountId, calendarId: user.writeCalendarId } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return apiError(err);
  }
}
