import { NextResponse } from "next/server";
import { apiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { calendarsForAccounts, listAccounts, visibleCalendarIds } from "@/lib/calendar";

/** Every connected account with its calendars and which ones the dashboard shows (for the sidebar). */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const groups = await calendarsForAccounts(await listAccounts(user.id));
    return NextResponse.json(
      {
        accounts: groups.map(({ account, calendars, error }) => ({
          id: account.id,
          provider: account.provider,
          email: account.email,
          connected: !!account.refreshToken,
          error,
          calendars: calendars.filter((c) => c.canReadEvents).map((c) => ({ id: c.id, name: c.summary, color: c.color })),
          visible: [...visibleCalendarIds(user, account)],
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return apiError(err);
  }
}
