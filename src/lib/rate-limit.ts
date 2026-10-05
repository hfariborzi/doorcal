import { createHash } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db, rateLimits } from "@/db";

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please wait a few minutes and try again.");
  }
}

/**
 * Limits for the public, unauthenticated endpoints, per client IP. Kept loose because a whole campus or
 * office can share one IP address.
 */
export const LIMITS = {
  slots: { limit: 180, windowSec: 60 }, // each call hits the host's Google free/busy
  book: { limit: 30, windowSec: 3600 }, // each booking sends Google invites, possibly to guests
  manage: { limit: 60, windowSec: 3600 }, // invitee cancel and reschedule
} as const;

export function clientIp(req: NextRequest) {
  // Vercel overwrites x-forwarded-for with the real client IP. Behind other proxies, make sure yours does too.
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

// Store a salted one-way hash, never the IP address itself.
function ipKey(req: NextRequest) {
  return createHash("sha256")
    .update(`rate-limit:${process.env.AUTH_SECRET ?? ""}:${clientIp(req)}`)
    .digest("base64url")
    .slice(0, 22);
}

/** Fixed-window counter in Postgres: one atomic upsert per call. Throws RateLimitError when over the limit. */
export async function rateLimit(req: NextRequest, bucket: keyof typeof LIMITS) {
  const { limit, windowSec } = LIMITS[bucket];
  const expired = sql`${rateLimits.windowStart} < now() - make_interval(secs => ${windowSec})`;
  const [row] = await db
    .insert(rateLimits)
    .values({ key: `${bucket}:${ipKey(req)}`, windowStart: sql`now()`, count: 1 })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${expired} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql`CASE WHEN ${expired} THEN now() ELSE ${rateLimits.windowStart} END`,
      },
    })
    .returning({ count: rateLimits.count });

  // Now and then, clear out counters nobody has touched for a day so the table stays small.
  if (Math.random() < 0.01) {
    await db
      .delete(rateLimits)
      .where(lt(rateLimits.windowStart, sql`now() - interval '1 day'`))
      .catch(() => {});
  }
  if (row.count > limit) throw new RateLimitError();
}
