"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, users, schedules, eventTypes, bookings, calendarAccounts } from "@/db";
import { requireUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/bookings";
import { getAccount, isConnected, listAccounts, providerFor } from "@/lib/calendar";
import { RESERVED_USERNAMES } from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { logError } from "@/lib/log";
import { SESSION_COOKIE } from "@/lib/session";

export type ActionResult = { error?: string; id?: number };

function firstIssue(err: z.ZodError) {
  const i = err.issues[0];
  return i ? `${i.path.join(".") ? i.path.join(".") + ": " : ""}${i.message}` : "Invalid input";
}

const tzSchema = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "Unknown time zone");

const timeRange = z
  .object({ start: z.string().regex(/^\d\d:\d\d$/), end: z.string().regex(/^\d\d:\d\d$/) })
  .refine((r) => r.start < r.end || r.end === "24:00", "End time must be after start time");

const locationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("online") }),
  z.object({ type: z.literal("in_person"), address: z.string().trim().min(1, "Enter an address") }),
  z.object({ type: z.literal("phone_host_calls") }),
  z.object({ type: z.literal("phone_invitee_calls"), phone: z.string().trim().min(3, "Enter your phone number") }),
  z.object({
    type: z.literal("custom_link"),
    url: z.string().trim().url("Enter a valid meeting URL"),
    label: z.string().trim().max(60).optional(),
  }),
]);

const eventTypeSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().trim().min(1, "Title is required").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,59}$/, "URL may only contain lowercase letters, numbers and dashes"),
  description: z.string().max(5000),
  durations: z.array(z.number().int().min(5).max(720)).min(1, "Add at least one duration").max(6),
  locations: z.array(locationSchema).min(1, "Add at least one location").max(6),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  scheduleId: z.number().int().nullable(),
  // "<accountId>:<calendarId>" or null for the user's default calendar.
  writeTarget: z.string().regex(/^\d{1,10}:.{1,300}$/).nullable(),
  bufferBefore: z.number().int().min(0).max(240),
  bufferAfter: z.number().int().min(0).max(240),
  minNotice: z.number().int().min(0).max(60 * 24 * 60),
  maxDaysAhead: z.number().int().min(1).max(730),
  slotInterval: z.number().int().min(5).max(720).nullable(),
  dailyLimit: z.number().int().min(1).max(100).nullable(),
  seats: z.number().int().min(1).max(500),
  questions: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1, "Question text is required").max(300),
        type: z.enum(["text", "textarea", "phone", "select"]),
        required: z.boolean(),
        options: z.array(z.string().trim().min(1)).max(50).optional(),
      }),
    )
    .max(20),
  hidden: z.boolean(),
  active: z.boolean(),
});

export type EventTypeInput = z.input<typeof eventTypeSchema>;

export async function saveEventType(input: EventTypeInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = eventTypeSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, writeTarget, ...rest } = parsed.data;
  const data = { ...rest, writeAccountId: null as number | null, writeCalendarId: null as string | null };
  data.durations = [...new Set(data.durations)].sort((a, b) => a - b);

  if (writeTarget) {
    const sep = writeTarget.indexOf(":");
    const accountId = writeTarget.slice(0, sep);
    const calendarId = writeTarget.slice(sep + 1);
    if (!(await getAccount(user.id, Number(accountId)))) return { error: "That calendar account is not connected" };
    data.writeAccountId = Number(accountId);
    data.writeCalendarId = calendarId;
  }

  if (data.scheduleId) {
    const [s] = await db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, data.scheduleId), eq(schedules.userId, user.id)));
    if (!s) return { error: "Schedule not found" };
  }

  const clash = await db
    .select({ id: eventTypes.id })
    .from(eventTypes)
    .where(
      and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, data.slug), id ? ne(eventTypes.id, id) : undefined),
    );
  if (clash.length) return { error: "You already have an event type with that URL" };

  let savedId = id;
  if (id) {
    await db.update(eventTypes).set(data).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  } else {
    const count = (await db.select({ id: eventTypes.id }).from(eventTypes).where(eq(eventTypes.userId, user.id))).length;
    const [row] = await db
      .insert(eventTypes)
      .values({ ...data, userId: user.id, position: count })
      .returning({ id: eventTypes.id });
    savedId = row.id;
  }
  revalidatePath("/dashboard", "layout");
  return { id: savedId };
}

export async function toggleEventType(id: number, active: boolean) {
  const user = await requireUser();
  await db.update(eventTypes).set({ active }).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  revalidatePath("/dashboard/event-types");
}

export async function deleteEventType(id: number) {
  const user = await requireUser();
  await db.delete(eventTypes).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  revalidatePath("/dashboard/event-types");
}

export async function duplicateEventType(id: number) {
  const user = await requireUser();
  const [et] = await db.select().from(eventTypes).where(and(eq(eventTypes.id, id), eq(eventTypes.userId, user.id)));
  if (!et) return;
  const { id: _omit, createdAt: _c, ...rest } = et;
  void _omit;
  void _c;
  let slug = `${et.slug}-copy`;
  for (let i = 2; ; i++) {
    const [taken] = await db
      .select({ id: eventTypes.id })
      .from(eventTypes)
      .where(and(eq(eventTypes.userId, user.id), eq(eventTypes.slug, slug)));
    if (!taken) break;
    slug = `${et.slug}-copy-${i}`;
  }
  await db.insert(eventTypes).values({ ...rest, slug, title: `${et.title} (copy)`, active: false });
  revalidatePath("/dashboard/event-types");
}

const scheduleSchema = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Name is required").max(80),
  timezone: tzSchema,
  weekly: z.record(z.string().regex(/^[1-7]$/, "Invalid weekday"), z.array(timeRange).max(10)),
  overrides: z
    .array(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ranges: z.array(timeRange).max(10) }))
    .max(366),
});

export type ScheduleInput = z.input<typeof scheduleSchema>;

export async function saveSchedule(input: ScheduleInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const { id, ...data } = parsed.data;
  let savedId = id;
  if (id) {
    await db.update(schedules).set(data).where(and(eq(schedules.id, id), eq(schedules.userId, user.id)));
  } else {
    const existing = await db.select({ id: schedules.id }).from(schedules).where(eq(schedules.userId, user.id));
    const [row] = await db
      .insert(schedules)
      .values({ ...data, userId: user.id, isDefault: existing.length === 0 })
      .returning({ id: schedules.id });
    savedId = row.id;
  }
  revalidatePath("/dashboard", "layout");
  return { id: savedId };
}

export async function setDefaultSchedule(id: number) {
  const user = await requireUser();
  await db.update(schedules).set({ isDefault: false }).where(eq(schedules.userId, user.id));
  await db.update(schedules).set({ isDefault: true }).where(and(eq(schedules.id, id), eq(schedules.userId, user.id)));
  revalidatePath("/dashboard/availability");
}

export async function deleteSchedule(id: number): Promise<ActionResult> {
  const user = await requireUser();
  const all = await db.select().from(schedules).where(eq(schedules.userId, user.id));
  const target = all.find((s) => s.id === id);
  if (!target) return { error: "Not found" };
  if (target.isDefault) return { error: "Make another schedule the default before deleting this one." };
  await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.userId, user.id)));
  revalidatePath("/dashboard/availability");
  return {};
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Username must be 2–40 lowercase letters, numbers or dashes")
    .refine((u) => !RESERVED_USERNAMES.has(u), "That username is reserved"),
  headline: z.string().trim().max(160),
  welcome: z.string().trim().max(2000),
  timezone: tzSchema,
});

export async function saveProfile(input: z.input<typeof profileSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.username, parsed.data.username), ne(users.id, user.id)));
  if (taken) return { error: "That username is already taken" };
  await db.update(users).set(parsed.data).where(eq(users.id, user.id));
  revalidatePath("/dashboard", "layout");
  return {};
}

const calendarSettingsSchema = z.object({
  accounts: z.array(z.object({ id: z.number().int(), conflictCalendarIds: z.array(z.string().min(1).max(300)).max(50) })).max(20),
  writeAccountId: z.number().int(),
  writeCalendarId: z.string().min(1).max(300),
});

export async function saveCalendarSettings(input: z.input<typeof calendarSettingsSchema>): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = calendarSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: firstIssue(parsed.error) };
  const owned = new Set((await listAccounts(user.id)).map((a) => a.id));
  for (const a of parsed.data.accounts) if (!owned.has(a.id)) return { error: "Unknown calendar account" };
  if (!owned.has(parsed.data.writeAccountId)) return { error: "Unknown calendar account" };

  for (const a of parsed.data.accounts) {
    await db
      .update(calendarAccounts)
      .set({ conflictCalendarIds: [...new Set(a.conflictCalendarIds)] })
      .where(and(eq(calendarAccounts.id, a.id), eq(calendarAccounts.userId, user.id)));
  }
  await db
    .update(users)
    .set({ writeAccountId: parsed.data.writeAccountId, writeCalendarId: parsed.data.writeCalendarId })
    .where(eq(users.id, user.id));
  revalidatePath("/dashboard", "layout");
  return {};
}

async function revokeAccess(account: { provider: "google" | "microsoft"; refreshToken: string | null }) {
  if (!account.refreshToken) return;
  try {
    await providerFor(account).revoke(decrypt(account.refreshToken));
  } catch (err) {
    logError("revoke", err); // the token may already be invalid; nothing else to do
  }
}

/** Disconnect one calendar account. The last one can't go: it's how the user signs in. */
export async function removeCalendarAccount(id: number): Promise<ActionResult> {
  const user = await requireUser();
  const accounts = await listAccounts(user.id);
  const target = accounts.find((a) => a.id === id);
  if (!target) return { error: "Unknown calendar account" };
  if (accounts.length === 1) return { error: "You can't remove your only account. Connect another one first, or delete your DoorCal account." };

  await revokeAccess(target);
  // Bookings and event types that pointed here fall back automatically (foreign keys set null).
  await db.delete(calendarAccounts).where(and(eq(calendarAccounts.id, id), eq(calendarAccounts.userId, user.id)));
  if (user.writeAccountId === id) {
    const next = accounts.find((a) => a.id !== id && isConnected(a)) ?? accounts.find((a) => a.id !== id);
    await db.update(users).set({ writeAccountId: next?.id ?? null, writeCalendarId: "primary" }).where(eq(users.id, user.id));
  }
  revalidatePath("/dashboard", "layout");
  return {};
}

export async function hostCancelBooking(uid: string, reason: string): Promise<ActionResult> {
  const user = await requireUser();
  const [b] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.uid, uid), eq(bookings.userId, user.id)));
  if (!b) return { error: "Booking not found" };
  try {
    await cancelBooking(uid, "host", reason);
  } catch (err) {
    return { error: (err as Error).message };
  }
  revalidatePath("/dashboard/bookings");
  return {};
}

export async function deleteAccount() {
  const user = await requireUser();
  for (const account of await listAccounts(user.id)) await revokeAccess(account);
  await db.delete(users).where(eq(users.id, user.id)); // cascades to accounts, schedules, event types, bookings
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/");
}
