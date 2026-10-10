/**
 * What Dori sees each turn: a compact picture of the user's areas, projects, open tasks, the coming week's
 * events and planned work, deadlines at risk, notes for the day and changes since last time.
 *
 * Privacy: events carry only their title, time, calendar name and attendee count. Attendee names and emails,
 * descriptions and locations never go to the model; when Dori drafts emails, the app adds recipients itself.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, tasks as tasksTable, type DayNote, type Plan, type Task, type User, type WeeklyHours } from "@/db";
import { eventsForAccounts, listAccounts, type CalendarEvent } from "../calendar";
import { ensureDefaults } from "../data";
import { listCategories } from "../labels";
import { blockedTaskIds, compareTasks, isComplete, listLinks, listProjects, listTasks } from "../tasks";

const MAX_OPEN_TASKS = 200;
const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type EventRefs = Map<string, CalendarEvent>;

export function greetingName(user: User) {
  return user.doriPrefs?.nickname?.trim() || user.name.split(/\s+/)[0] || "there";
}

function hhmm(iso: string, tz: string) {
  return DateTime.fromISO(iso, { zone: tz }).toFormat("HH:mm");
}

function dayOf(iso: string, tz: string) {
  const d = DateTime.fromISO(iso, { zone: tz });
  return `${DAY_NAMES[d.weekday]} ${d.toISODate()}`;
}

function hoursText(weekly: WeeklyHours) {
  return [1, 2, 3, 4, 5, 6, 7].map((d) => `${DAY_NAMES[d]} ${(weekly[String(d)] ?? []).map((r) => `${r.start}-${r.end}`).join(",") || "off"}`).join("; ");
}

/** Calendar events in a window, registered under short refs ("e1", "e2") the model can point at. */
export async function eventsWithRefs(user: User, from: Date, to: Date, refs: EventRefs) {
  const { events, problems } = await eventsForAccounts(user, await listAccounts(user.id), from, to);
  const tz = user.timezone;
  const rows = events
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 250)
    .map((e) => {
      const existing = [...refs.entries()].find(([, v]) => v.id === e.id && v.accountId === e.accountId)?.[0];
      const ref = existing ?? `e${refs.size + 1}`;
      refs.set(ref, e);
      return e.allDay
        ? { ref, day: dayOf(e.start, tz), allDay: true, title: e.title.slice(0, 120), calendar: e.calendarName?.slice(0, 40) }
        : { ref, day: dayOf(e.start, tz), start: hhmm(e.start, tz), end: hhmm(e.end, tz), title: e.title.slice(0, 120), calendar: e.calendarName?.slice(0, 40), attendees: e.attendees.length };
    });
  return { rows, problems };
}

export async function buildContext(user: User, plan: Plan, refs: EventRefs, notes: DayNote[]) {
  const tz = user.timezone;
  const now = DateTime.now().setZone(tz);
  const [areas, projects, tasks, links, recent] = await Promise.all([
    listCategories(user.id),
    listProjects(user.id),
    listTasks(user.id),
    listLinks(user.id),
    db.select().from(tasksTable).where(and(eq(tasksTable.userId, user.id), gte(tasksTable.completedAt, now.minus({ days: 7 }).toJSDate()))).orderBy(desc(tasksTable.completedAt)).limit(20),
  ]);
  const weekly = user.workHours ?? (await ensureDefaults(user)).schedule.weekly;
  const blocked = blockedTaskIds(tasks, links);
  const open = tasks.filter((t) => !isComplete(t.status)).sort(compareTasks).slice(0, MAX_OPEN_TASKS);
  const titles = new Map(tasks.map((t) => [t.id, t.title]));
  const { rows: events, problems } = await eventsWithRefs(user, now.startOf("day").toJSDate(), now.plus({ days: 7 }).endOf("day").toJSDate(), refs);
  const weekEnd = now.plus({ days: 7 }).toMillis();
  const unseen = plan.notices.filter((n) => !plan.noticesSeenAt || Date.parse(n.at) > plan.noticesSeenAt.getTime());

  const taskRow = (t: Task) => ({
    id: t.id,
    title: t.title.slice(0, 160),
    ...(t.projectId ? { project: t.projectId } : {}),
    ...(t.categoryId ? { area: t.categoryId } : {}),
    ...(t.kind === "reminder" ? { reminder: true } : { est: t.estimateMinutes ?? null }),
    ...(t.dueDate ? { due: t.dueDate, ...(t.hardDeadline ? { hard: true } : {}) } : {}),
    ...(t.priority !== "normal" ? { priority: t.priority } : {}),
    ...(t.energy ? { energy: t.energy } : {}),
    ...(t.people.length ? { people: t.people } : {}),
    ...(t.repeat ? { repeat: t.repeat } : {}),
    ...(t.notes ? { notes: t.notes.slice(0, 160) } : {}),
    ...(blocked.has(t.id) ? { waiting: true } : {}),
  });

  const data = {
    now: `${DAY_NAMES[now.weekday]} ${now.toFormat("yyyy-MM-dd HH:mm")} (${tz})`,
    user: { name: user.name.split(/\s+/)[0] || "", greet_as: greetingName(user) },
    work_hours: hoursText(weekly),
    areas: areas.map((a) => ({ id: a.id, name: a.name, ...(a.description ? { about: a.description } : {}) })),
    projects: projects.filter((p) => p.status !== "done").map((p) => ({ id: p.id, name: p.name, ...(p.categoryId ? { area: p.categoryId } : {}), ...(p.targetDate ? { target: p.targetDate } : {}), ...(p.status !== "active" ? { status: p.status } : {}) })),
    open_tasks: open.map(taskRow),
    loose_ends: tasks.filter((t) => t.status === "good_enough" && t.residue).slice(0, 30).map((t) => ({ task: t.id, title: t.title.slice(0, 100), left: t.residue, since: t.completedAt?.toISOString().slice(0, 10) })),
    done_this_week: recent.map((t) => ({ title: t.title.slice(0, 100), status: t.status })),
    calendar_next_7_days: events,
    planned_work_next_7_days: plan.blocks
      .filter((b) => Date.parse(b.start) < weekEnd)
      .slice(0, 120)
      .map((b) => ({ task: b.taskId, day: dayOf(b.start, tz), start: hhmm(b.start, tz), end: hhmm(b.end, tz), ...(b.pinned ? { pinned: true } : {}) })),
    at_risk: plan.atRisk.map((r) => ({ task: r.taskId, title: titles.get(r.taskId), reason: r.reason, ...(r.finishesAt ? { finishes: dayOf(r.finishesAt, tz) } : {}) })),
    notes: notes.map((n) => ({ id: n.id, day: n.day ?? "always", text: n.text })),
    changes_since_last_time: unseen.map((n) => n.text),
    ...(problems.length ? { calendar_problems: problems.map((p) => `${p.email} ${p.message}`) } : {}),
  };
  return { text: JSON.stringify(data), unseenNotices: unseen.length };
}
