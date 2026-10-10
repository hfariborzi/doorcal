import { NextResponse, type NextRequest } from "next/server";
import { ensureWatches, pruneExpiredWatches, usersWithAccounts } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";

// Renewing channels touches every connected account; give it room.
export const maxDuration = 60;

/**
 * Daily housekeeping (scheduled in vercel.json): renew calendar push channels before they expire and forget
 * ones that already did. Vercel sends CRON_SECRET as a bearer token; without it set, the job refuses to run.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const started = Date.now();
  let done = 0;
  await pruneExpiredWatches().catch((err) => logError("cron prune", err));
  for (const userId of await usersWithAccounts()) {
    if (Date.now() - started > 50_000) break;
    await ensureWatches(userId).catch((err) => logError("cron watches", err));
    done++;
  }
  return NextResponse.json({ ok: true, users: done });
}
