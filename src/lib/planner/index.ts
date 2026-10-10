/**
 * Loads a user's planning inputs (working hours, busy time from every connected calendar, tasks, links, pinned
 * work, day notes), runs the planner and stores the result. Recomputed lazily: when something marks the plan
 * dirty (a task changed, a calendar push notification arrived) or when the stored plan is older than
 * STALE_MS, the next read recomputes it.
 */
import { and, asc, eq, gte, isNull, or } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, dayNotes, pinnedBlocks, plans, users, type DayNote, type Plan, type PlanBlock, type User, type WeeklyHours } from "@/db";
import { listAccounts, isConnected, providerFor } from "../calendar";
import type { Interval } from "../calendar/types";
import { ensureDefaults } from "../data";
import { logWarn } from "../log";
import { listLinks, listTasks } from "../tasks";
import { describeMoves, freeMinutesUntil, HORIZON_DAYS, meetingSlots, plan as runPlan, type PlanInput, type PlanOutput } from "./core";

export * from "./core";

const STALE_MS = 30 * 60_000;

export type Inputs = { input: PlanInput; titles: Map<number, string>; notes: DayNote[]; calendarProblems: string[] };

async function workingHours(user: User): Promise<{ weekly: WeeklyHours; overrides: PlanInput["overrides"] }> {
  if (user.workHours) return { weekly: user.workHours, overrides: [] };
  const { schedule } = await ensureDefaults(user);
  return { weekly: schedule.weekly, overrides: schedule.overrides };
}

/** Busy time across every connected account's conflict calendars. An account that fails is skipped, not fatal. */
async function busyTime(user: User, from: Date, to: Date): Promise<{ busy: Interval[]; problems: string[] }> {
  const busy: Interval[] = [];
  const problems: string[] = [];
  await Promise.all(
    (await listAccounts(user.id)).map(async (a) => {
      if (!a.conflictCalendarIds.length) return;
      if (!isConnected(a)) {
        problems.push(`${a.email} needs reconnecting`);
        return;
      }
      try {
        busy.push(...(await providerFor(a).getBusy(a, a.conflictCalendarIds, from, to, user.timezone)));
      } catch (err) {
        logWarn("planner", `busy time for account ${a.id}: ${(err as Error).message}`);
        problems.push(`${a.email} could not be read`);
      }
    }),
  );
  return { busy, problems };
}

export function todayIn(tz: string) {
  return DateTime.now().setZone(tz).toISODate()!;
}

/** Notes for today onward, plus standing notes. */
export async function listNotes(user: User): Promise<DayNote[]> {
  return db.select().from(dayNotes).where(and(eq(dayNotes.userId, user.id), or(isNull(dayNotes.day), gte(dayNotes.day, todayIn(user.timezone))))).orderBy(asc(dayNotes.id));
}

export async function loadInputs(user: User, horizonDays = HORIZON_DAYS): Promise<Inputs> {
  const now = Date.now();
  const tz = user.timezone;
  const [hours, tasks, links, pinned, notes, busyResult] = await Promise.all([
    workingHours(user),
    listTasks(user.id),
    listLinks(user.id),
    db.select().from(pinnedBlocks).where(and(eq(pinnedBlocks.userId, user.id), gte(pinnedBlocks.end, new Date(now)))),
    listNotes(user),
    busyTime(user, new Date(now), new Date(now + (horizonDays + 1) * 86_400_000)),
  ]);
  const input: PlanInput = {
    tz,
    now,
    horizonDays,
    weekly: hours.weekly,
    overrides: hours.overrides,
    busy: busyResult.busy,
    tasks: tasks.map((t) => ({ id: t.id, title: t.title, estimateMinutes: t.estimateMinutes, dueDate: t.dueDate, hardDeadline: t.hardDeadline, priority: t.priority, energy: t.energy, status: t.status, kind: t.kind, position: t.position })),
    links,
    pinned: pinned.map((p) => ({ taskId: p.taskId, start: p.start.getTime(), end: p.end.getTime() })),
    rules: notes.filter((n) => n.day).map((n) => ({ day: n.day!, avoidEnergy: n.avoidEnergy, skipTaskIds: n.skipTaskIds, reserveForTaskIds: n.reserveForTaskIds, maxWorkMinutes: n.maxWorkMinutes })),
  };
  return { input, titles: new Map(tasks.map((t) => [t.id, t.title])), notes, calendarProblems: busyResult.problems };
}

const toStored = (out: PlanOutput) => ({
  blocks: out.blocks.map<PlanBlock>((b) => ({ taskId: b.taskId, start: new Date(b.start).toISOString(), end: new Date(b.end).toISOString(), pinned: b.pinned })),
  atRisk: out.atRisk.map((r) => ({ taskId: r.taskId, reason: r.reason, finishesAt: r.finishesAt ? new Date(r.finishesAt).toISOString() : undefined })),
});

/**
 * Recompute and store the plan. With `notify`, moves of more than half an hour are kept as notices for Dori
 * to mention (used when the calendar changed under the plan, not when the user just edited a task).
 */
export async function replan(user: User, opts: { notify?: boolean } = {}): Promise<{ plan: Plan; inputs: Inputs; out: PlanOutput }> {
  const inputs = await loadInputs(user);
  const out = runPlan(inputs.input);
  const stored = toStored(out);
  const [prev] = await db.select().from(plans).where(eq(plans.userId, user.id)).limit(1);
  let notices = prev?.notices ?? [];
  if (opts.notify && prev) {
    const before = prev.blocks.map((b) => ({ taskId: b.taskId, start: Date.parse(b.start), end: Date.parse(b.end), pinned: b.pinned }));
    const moves = describeMoves(before, out.blocks, inputs.titles, user.timezone);
    if (moves.length) notices = [...notices, ...moves.map((text) => ({ at: new Date().toISOString(), text }))].slice(-20);
  }
  const values = { userId: user.id, ...stored, notices, computedAt: new Date() };
  const [row] = await db
    .insert(plans)
    .values(values)
    .onConflictDoUpdate({ target: plans.userId, set: { blocks: values.blocks, atRisk: values.atRisk, notices: values.notices, computedAt: values.computedAt } })
    .returning();
  return { plan: row, inputs, out };
}

/** The stored plan, recomputed first if something changed or it is stale. */
export async function freshPlan(user: User): Promise<Plan> {
  const [current] = await db.select().from(plans).where(eq(plans.userId, user.id)).limit(1);
  const dirty = !current || (user.planDirtyAt && user.planDirtyAt > current.computedAt) || Date.now() - current.computedAt.getTime() > STALE_MS;
  if (!dirty) return current;
  return (await replan(user, { notify: !!current })).plan;
}

/** Something the plan depends on changed; the next read recomputes it. */
export async function markPlanDirty(userId: number) {
  await db.update(users).set({ planDirtyAt: new Date() }).where(eq(users.id, userId));
}

export async function slotsFor(user: User, opts: Parameters<typeof meetingSlots>[2]) {
  const inputs = await loadInputs(user);
  const out = runPlan(inputs.input);
  return { slots: meetingSlots(inputs.input, out, opts), titles: inputs.titles };
}

/**
 * Could the user take on `minutes` more work by `byDay`? Plans a stand-in task and reports free time before
 * and which existing tasks would become late or unplanned.
 */
export async function capacityFor(user: User, minutes: number, byDay: string | null) {
  // Look as far ahead as the deadline (at most four months), so free time is counted over the whole period.
  const days = byDay ? Math.min(120, Math.max(HORIZON_DAYS, Math.ceil(DateTime.fromISO(byDay, { zone: user.timezone }).diff(DateTime.now().setZone(user.timezone), "days").days) + 1)) : HORIZON_DAYS;
  const inputs = await loadInputs(user, days);
  const base = runPlan(inputs.input);
  const ghost = { id: -1, title: "New work", estimateMinutes: minutes, dueDate: byDay, hardDeadline: false, priority: "normal" as const, energy: null, status: "open" as const, kind: "task" as const, position: -1 };
  const withNew = runPlan({ ...inputs.input, tasks: [...inputs.input.tasks, ghost] });
  const riskIds = new Set(base.atRisk.map((r) => r.taskId));
  const newlyAtRisk = withNew.atRisk.filter((r) => r.taskId > 0 && !riskIds.has(r.taskId)).map((r) => inputs.titles.get(r.taskId) ?? "a task");
  const newWorkFits = !withNew.atRisk.some((r) => r.taskId === -1);
  const until = byDay ?? DateTime.fromMillis(inputs.input.now, { zone: user.timezone }).plus({ days: days - 1 }).toISODate()!;
  return { freeMinutes: freeMinutesUntil(inputs.input, base, until), newWorkFits, newlyAtRisk, until, days };
}
