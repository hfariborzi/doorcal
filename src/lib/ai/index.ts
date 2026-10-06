/**
 * The two things the AI does, both opt-in: propose a category list from a sample of the user's events, and
 * sort events that no rule covers into the user's approved categories. What is sent per event: title,
 * length, whether it repeats, how many attendees, whether it has a video link, and the calendar's name.
 * Never descriptions, attendee identities or booking data.
 */
import { and, eq, sql } from "drizzle-orm";
import { db, aiUsage, type Category, type Priority } from "@/db";
import type { CalendarEvent } from "../calendar/types";
import { eventKey, isPriority, MAX_CATEGORIES, normalizeTitle } from "../labels/core";
import { CLASSIFY_BATCH, classifyJsonSchema, classifyPrompt, classifySchema, proposalJsonSchema, proposalPrompt, proposalSchema, type EventSample } from "./prompts";
import { logError } from "../log";
import { aiConfigured, completeJson, type Usage } from "./client";

export { aiConfigured, AI_PROVIDER_NAME } from "./client";
export { CLASSIFY_BATCH, type EventSample } from "./prompts";

/** Per-user and instance-wide caps on events classified per day, so a bug or a flood can't run up a bill. */
const USER_DAILY_CAP = Number(process.env.AI_MAX_EVENTS_PER_USER_PER_DAY) || 300;
const INSTANCE_DAILY_CAP = Number(process.env.AI_MAX_EVENTS_PER_DAY) || 20_000;
export function toSample(e: CalendarEvent): EventSample {
  const start = Date.parse(e.start);
  const end = Date.parse(e.end);
  return {
    title: e.title.slice(0, 120),
    minutes: e.allDay ? 0 : Math.max(0, Math.round((end - start) / 60_000)),
    recurring: !!e.seriesId,
    attendees: e.attendees.length,
    video: !!e.meetLink,
    calendar: (e.calendarName ?? "").slice(0, 40),
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Reserve `n` events of today's quota; returns how many may be sent (0 when capped). */
async function reserveQuota(userId: number, n: number): Promise<number> {
  const day = today();
  const [mine] = await db.select({ events: aiUsage.events }).from(aiUsage).where(and(eq(aiUsage.userId, userId), eq(aiUsage.day, day)));
  const [all] = await db.select({ events: sql<number>`coalesce(sum(${aiUsage.events}), 0)` }).from(aiUsage).where(eq(aiUsage.day, day));
  const room = Math.min(USER_DAILY_CAP - (mine?.events ?? 0), INSTANCE_DAILY_CAP - Number(all?.events ?? 0));
  return Math.max(0, Math.min(n, room));
}

async function recordUsage(userId: number, events: number, usage: Usage) {
  await db
    .insert(aiUsage)
    .values({ userId, day: today(), events, requests: 1, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.day],
      set: {
        events: sql`${aiUsage.events} + ${events}`,
        requests: sql`${aiUsage.requests} + 1`,
        inputTokens: sql`${aiUsage.inputTokens} + ${usage.inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${usage.outputTokens}`,
      },
    });
}

export async function usageThisMonth(userId: number) {
  const prefix = today().slice(0, 7);
  const [row] = await db
    .select({ events: sql<number>`coalesce(sum(${aiUsage.events}), 0)`, requests: sql<number>`coalesce(sum(${aiUsage.requests}), 0)` })
    .from(aiUsage)
    .where(and(eq(aiUsage.userId, userId), sql`${aiUsage.day} like ${prefix + "%"}`));
  return { events: Number(row?.events ?? 0), requests: Number(row?.requests ?? 0) };
}

export type Proposal = { name: string; defaultPriority: Priority; sampleIndexes: number[] }[];

/** Propose 4–10 categories that cover these events. Returns [] when the model's answer is unusable. */
export async function proposeCategories(userId: number, samples: EventSample[]): Promise<Proposal> {
  if (!aiConfigured() || samples.length === 0) return [];
  const allowed = await reserveQuota(userId, samples.length);
  const use = samples.slice(0, allowed);
  if (use.length === 0) throw new Error("Daily AI limit reached. Try again tomorrow.");

  // A proposal over a few hundred events takes a reasoning model 15–30 s.
  const { data, usage } = await completeJson({ name: "categories", schema: proposalSchema, jsonSchema: proposalJsonSchema, maxTokens: 4000, timeoutMs: 60_000, ...proposalPrompt(use) });
  await recordUsage(userId, use.length, usage);

  const seen = new Set<string>();
  return data.categories
    .map((c) => ({
      name: c.name.replace(/\s+/g, " ").trim(),
      defaultPriority: (isPriority(c.defaultPriority) ? c.defaultPriority : "normal") as Priority,
      sampleIndexes: [...new Set(c.samples.filter((i) => i < use.length))],
    }))
    .filter((c) => c.name && !seen.has(normalizeTitle(c.name)) && seen.add(normalizeTitle(c.name)))
    .slice(0, MAX_CATEGORIES);
}

// --- Classification -------------------------------------------------------------------------------------

/**
 * Sort events into the user's categories. Returns, per event index, the category id or null for Other.
 * Events the model skipped or answered with an unknown id are left out so they get another chance later.
 */
export async function classifyEvents(userId: number, cats: Category[], events: CalendarEvent[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  if (!aiConfigured() || cats.length === 0 || events.length === 0) return out;
  const allowed = await reserveQuota(userId, Math.min(events.length, CLASSIFY_BATCH));
  const batch = events.slice(0, allowed);
  if (batch.length === 0) return out;

  const ids = new Set(cats.map((c) => String(c.id)));
  try {
    const { data, usage } = await completeJson({
      name: "labels",
      schema: classifySchema,
      jsonSchema: classifyJsonSchema,
      // Generous: reasoning models spend tokens thinking before the short answer.
      maxTokens: 2000 + 12 * batch.length,
      ...classifyPrompt(cats, batch.map(toSample)),
    });
    await recordUsage(userId, batch.length, usage);
    for (const l of data.labels) {
      const e = batch[l.i];
      if (!e) continue;
      if (l.c === "other") out.set(eventKey(e), null);
      else if (ids.has(l.c)) out.set(eventKey(e), Number(l.c));
    }
  } catch (err) {
    logError("ai classify", err);
  }
  return out;
}
