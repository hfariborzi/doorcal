import { after } from "next/server";
import { eq } from "drizzle-orm";
import { db, users, type User } from "@/db";
import { aiConfigured, classifyEvents, CLASSIFY_BATCH } from "@/lib/ai";
import type { CalendarEvent } from "@/lib/calendar/types";
import { eventKey, labelEvents, storeLabels, titleHash, type LabelledEvents } from "@/lib/labels";
import { logError } from "@/lib/log";

/**
 * Labels for the events in a calendar response. Events nothing covers go to the AI after the response is
 * sent (only if the user opted in), so the calendar never waits on the model.
 */
export async function labelsForResponse(user: User, events: CalendarEvent[]): Promise<LabelledEvents & { pendingAi: number }> {
  const result = await labelEvents(user.id, events);
  const pending = user.aiConsentAt && aiConfigured() ? result.unlabeled.slice(0, CLASSIFY_BATCH) : [];
  if (pending.length) {
    after(async () => {
      try {
        // Re-check consent: the user may have switched it off while this request was in flight.
        const [fresh] = await db.select({ aiConsentAt: users.aiConsentAt }).from(users).where(eq(users.id, user.id));
        if (!fresh?.aiConsentAt) return;
        const decided = await classifyEvents(user.id, result.categories, pending);
        const rows = pending
          .filter((e) => decided.has(eventKey(e)))
          .map((e) => ({ userId: user.id, accountId: e.accountId, eventKey: eventKey(e), titleHash: titleHash(e.title), categoryId: decided.get(eventKey(e)) ?? null, priority: null, source: "ai" as const }));
        if (rows.length) await storeLabels(rows);
      } catch (err) {
        logError("ai labels", err);
      }
    });
  }
  return { ...result, pendingAi: pending.length };
}
