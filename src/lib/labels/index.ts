/**
 * Labels for calendar events: user-set, rule-based, or (if the user opted in) AI-suggested.
 * Only labels and title hashes are stored; titles never are.
 */
import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, categories, eventLabels, labelRules, type Category, type EventLocationKind, type LabelRule, type LabelSource, type Priority } from "@/db";
import type { CalendarEvent } from "../calendar/types";
import { effectivePriority, eventKey, locationKind, matchRule, normalizeTitle, STARTER_CATEGORIES } from "./core";

export * from "./core";

export function titleHash(title: string) {
  return createHash("sha256").update(normalizeTitle(title)).digest("base64url").slice(0, 32);
}

export type ResolvedLabel = {
  categoryId: number | null; // null = Other
  priority: Priority;
  source: LabelSource | null; // null = not labelled yet
  location: EventLocationKind;
};

export type LabelledEvents = {
  labels: Record<string, ResolvedLabel>; // keyed by `${accountId}:${eventKey}`
  categories: Category[];
  unlabeled: CalendarEvent[]; // one per key, for the AI to look at
};

export const labelKey = (e: Pick<CalendarEvent, "accountId" | "id" | "seriesId">) => `${e.accountId}:${eventKey(e)}`;

export async function listCategories(userId: number): Promise<Category[]> {
  return db.select().from(categories).where(eq(categories.userId, userId)).orderBy(asc(categories.position), asc(categories.id));
}

export async function listRules(userId: number): Promise<LabelRule[]> {
  return db.select().from(labelRules).where(eq(labelRules.userId, userId)).orderBy(asc(labelRules.position), asc(labelRules.id));
}

/** Give a user the starter categories the first time they open the categories feature. */
export async function ensureCategories(userId: number): Promise<Category[]> {
  const existing = await listCategories(userId);
  if (existing.length) return existing;
  await db.insert(categories).values(STARTER_CATEGORIES.map((c, i) => ({ userId, ...c, position: i })));
  return listCategories(userId);
}

/**
 * Resolve a label for every event: stored labels first (a hand-set label always sticks; rule and AI labels
 * are redone when the title changed), then rules. Whatever is left is returned for the AI, if enabled.
 */
export async function labelEvents(userId: number, events: CalendarEvent[]): Promise<LabelledEvents> {
  const cats = await listCategories(userId);
  const catById = new Map(cats.map((c) => [c.id, c]));
  const rules = await listRules(userId);

  // One representative per key (recurring instances share a label).
  const byKey = new Map<string, CalendarEvent>();
  for (const e of events) if (!byKey.has(labelKey(e))) byKey.set(labelKey(e), e);

  const keys = [...byKey.values()].map((e) => eventKey(e));
  const stored = keys.length
    ? await db
        .select()
        .from(eventLabels)
        .where(and(eq(eventLabels.userId, userId), inArray(eventLabels.eventKey, keys)))
    : [];
  const storedByKey = new Map(stored.map((l) => [`${l.accountId}:${l.eventKey}`, l]));

  const labels: Record<string, ResolvedLabel> = {};
  const unlabeled: CalendarEvent[] = [];
  const upserts: (typeof eventLabels.$inferInsert)[] = [];

  for (const [key, e] of byKey) {
    const hash = titleHash(e.title);
    const location = locationKind(e);
    const existing = storedByKey.get(key);
    if (existing && (existing.source === "user" || existing.titleHash === hash)) {
      labels[key] = {
        categoryId: existing.categoryId,
        priority: effectivePriority(existing, existing.categoryId ? (catById.get(existing.categoryId) ?? null) : null),
        source: existing.source,
        location,
      };
      continue;
    }
    const rule = matchRule(rules, e.title);
    if (rule) {
      const cat = rule.categoryId ? (catById.get(rule.categoryId) ?? null) : null;
      labels[key] = { categoryId: rule.categoryId, priority: effectivePriority(rule, cat), source: "rule", location };
      upserts.push({ userId, accountId: e.accountId, eventKey: eventKey(e), titleHash: hash, categoryId: rule.categoryId, priority: rule.priority, source: "rule" });
      continue;
    }
    labels[key] = { categoryId: null, priority: "normal", source: null, location };
    unlabeled.push(e);
  }

  if (upserts.length) await storeLabels(upserts);
  return { labels, categories: cats, unlabeled };
}

export async function storeLabels(rows: (typeof eventLabels.$inferInsert)[]) {
  for (let i = 0; i < rows.length; i += 100) {
    await db
      .insert(eventLabels)
      .values(rows.slice(i, i + 100))
      .onConflictDoUpdate({
        target: [eventLabels.accountId, eventLabels.eventKey],
        set: {
          titleHash: sqlExcluded("title_hash"),
          categoryId: sqlExcluded("category_id"),
          priority: sqlExcluded("priority"),
          source: sqlExcluded("source"),
          updatedAt: new Date(),
        },
      });
  }
}

// Drizzle has no `excluded` helper; reference Postgres's EXCLUDED row directly.
import { sql } from "drizzle-orm";
function sqlExcluded(column: string) {
  return sql.raw(`excluded."${column}"`);
}
