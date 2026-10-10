/**
 * Dori's tools. Every tool validates its input with zod, acts only on the signed-in user's data through the
 * same rules as the UI, and records how to undo what it did. Anything that touches someone else or the
 * calendar (an email, a new event) becomes a card the user confirms; Dori never sends or books on her own.
 */
import { and, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import {
  db, categories, dayNotes, pinnedBlocks, projects, taskLinks, tasks, users,
  type DoriCard, type DoriProposal, type Task, type UndoOp, type User,
} from "@/db";
import type { ToolDef } from "../ai/client";
import { listAccounts } from "../calendar";
import { CATEGORY_PALETTE, MAX_CATEGORIES, listCategories } from "../labels";
import { capacityFor, freshPlan, replan, slotsFor, todayIn } from "../planner";
import { MAX_PROJECTS, MAX_TASKS, applyStatus, getTask, listLinks, listProjects, listTasks, ownedTasks, wouldCycle } from "../tasks";
import { eventsWithRefs, type EventRefs } from "./context";

export type ToolContext = {
  user: User;
  refs: EventRefs;
  undo: UndoOp[];
  actions: string[];
  cards: DoriCard[];
  proposal?: DoriProposal;
  changed: boolean; // tasks, notes or pins changed: the plan must be recomputed
  celebrated: boolean; // something got finished
  concerned: boolean; // a deadline or capacity warning came up
};

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");
const time = z.string().regex(/^\d{2}:\d{2}$/, "use HH:mm");
const priority = z.enum(["high", "normal", "low"]);
const energy = z.enum(["deep", "light"]);
// "never" is accepted (models like to fill every field) and means no repeat.
const repeat = z.enum(["never", "daily", "weekdays", "weekly", "monthly"]).transform((v) => (v === "never" ? null : v));
// Models often send "" or 0 for fields they mean to leave empty; treat those as absent instead of failing a round.
const blankToUndefined = (v: unknown) => (v === "" || v === null ? undefined : v);
const opt = <T extends z.ZodTypeAny>(s: T) => z.preprocess(blankToUndefined, s.optional());

const taskFields = {
  title: z.string().trim().min(1).max(200),
  project: opt(z.union([z.number().int(), z.string().max(120)])),
  area: opt(z.union([z.number().int(), z.string().max(60)])),
  kind: opt(z.enum(["task", "reminder"])),
  estimate_minutes: opt(z.preprocess((v) => (v === 0 ? undefined : typeof v === "number" ? Math.max(5, Math.min(24 * 60, Math.round(v))) : v), z.number().int().optional())),
  due_date: opt(day),
  hard_deadline: opt(z.boolean()),
  priority: opt(priority),
  energy: opt(energy),
  notes: opt(z.string().max(2000)),
  people: opt(z.array(z.string().trim().min(1).max(120)).max(20)),
  repeat: opt(repeat),
};

// JSON schemas for the model. Kept plain (no strict mode) so every OpenAI-compatible provider accepts them.
const S = {
  str: (description?: string) => ({ type: "string", ...(description ? { description } : {}) }),
  int: (description?: string) => ({ type: "integer", ...(description ? { description } : {}) }),
  bool: { type: "boolean" },
  enum: (values: string[], description?: string) => ({ type: "string", enum: values, ...(description ? { description } : {}) }),
  arr: (items: object, description?: string) => ({ type: "array", items, ...(description ? { description } : {}) }),
  obj: (properties: Record<string, object>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false }),
};
const idOrName = (what: string) => ({ anyOf: [{ type: "integer" }, { type: "string" }], description: `${what} id, or its exact name` });
const taskProps = {
  title: S.str(),
  project: idOrName("Existing project"),
  area: idOrName("Area (used when there is no project)"),
  kind: S.enum(["task", "reminder"], "reminder = something to remember with no time (errands, chores); never scheduled"),
  estimate_minutes: S.int("Your best guess when the user didn't say"),
  due_date: S.str("YYYY-MM-DD"),
  hard_deadline: S.bool,
  priority: S.enum(["high", "normal", "low"]),
  energy: S.enum(["deep", "light"], "deep = needs focus"),
  notes: S.str(),
  people: S.arr(S.str(), "Names the user mentioned"),
  repeat: S.enum(["never", "daily", "weekdays", "weekly", "monthly"], "Leave out unless the user said it repeats"),
};

export const TOOL_DEFS: ToolDef[] = [
  { type: "function", function: { name: "propose_plan", description: "For a brain dump or setting up many things at once: propose areas, projects and tasks for the user to review. Nothing is created until they accept. Reuse existing area and project names where they fit.", parameters: S.obj({
    areas: S.arr(S.obj({ name: S.str(), description: S.str() }, ["name"]), "Only new areas"),
    projects: S.arr(S.obj({ ref: S.str("Short id like p1, used by tasks"), name: S.str(), area: S.str("Area name"), target_date: S.str("YYYY-MM-DD"), notes: S.str() }, ["ref", "name"])),
    tasks: S.arr(S.obj({ ...taskProps, project: S.str("A project ref from this proposal, or an existing project's exact name"), area: S.str("Area name, when there is no project") }, ["title"])),
    links: S.arr(S.obj({ before: S.int("Index into tasks"), after: S.int("Index into tasks") }, ["before", "after"]), "Ordering: 'after' can only start when 'before' is done"),
  }, ["areas", "projects", "tasks", "links"]) } },
  { type: "function", function: { name: "add_tasks", description: "Add one or a few tasks or reminders right away (\"add …\", \"remind me to …\").", parameters: S.obj({ tasks: S.arr(S.obj(taskProps, ["title"])) }, ["tasks"]) } },
  { type: "function", function: { name: "update_task", description: "Change a task: title, project, due date, estimate, priority, energy, notes, people, repeat, kind.", parameters: S.obj({ id: S.int(), ...taskProps, title: S.str("New title") }, ["id"]) } },
  { type: "function", function: { name: "set_task_status", description: "Mark a task done, good enough (mostly done, with a short note of what's left), dropped, or open again.", parameters: S.obj({ id: S.int(), status: S.enum(["done", "good_enough", "dropped", "open"]), residue: S.str("What is left, for good_enough") }, ["id", "status"]) } },
  { type: "function", function: { name: "delete_tasks", description: "Delete tasks the user asked to remove.", parameters: S.obj({ ids: S.arr(S.int()) }, ["ids"]) } },
  { type: "function", function: { name: "create_project", description: "Create a project under an area.", parameters: S.obj({ name: S.str(), area: idOrName("Area"), target_date: S.str("YYYY-MM-DD"), notes: S.str() }, ["name"]) } },
  { type: "function", function: { name: "update_project", description: "Rename a project, move it to another area, change its target date or notes, or pause or finish it.", parameters: S.obj({ id: S.int(), name: S.str(), area: idOrName("Area"), target_date: S.str("YYYY-MM-DD"), notes: S.str(), status: S.enum(["active", "paused", "done"]) }, ["id"]) } },
  { type: "function", function: { name: "create_area", description: "Create a new area of life (e.g. Research, Home). Areas also colour the calendar.", parameters: S.obj({ name: S.str(), description: S.str() }, ["name"]) } },
  { type: "function", function: { name: "link_tasks", description: "Say one task must be done before another, or that tasks go together.", parameters: S.obj({ before: S.int("Task id that comes first"), after: S.int("Task id that comes after"), together: S.arr(S.int(), "Instead of before/after: two task ids that go together") }) } },
  { type: "function", function: { name: "add_day_note", description: "Remember something about a day or always: moods (\"not in the mood for writing today\"), days kept for one thing (a new deadline), or a cap on work hours. The planner follows the structured fields.", parameters: S.obj({
    day: S.str("YYYY-MM-DD, or omit for a standing note"), note: S.str("In the user's words, short"),
    avoid_energy: S.enum(["deep", "light"], "Don't plan this kind of work that day"),
    skip_task_ids: S.arr(S.int(), "Don't plan these tasks that day"),
    reserve_for_task_ids: S.arr(S.int(), "Only plan these tasks that day"),
    max_work_minutes: S.int("At most this much planned work that day"),
  }, ["note"]) } },
  { type: "function", function: { name: "remove_day_notes", description: "Forget notes, e.g. when the user's mood changed.", parameters: S.obj({ ids: S.arr(S.int()) }, ["ids"]) } },
  { type: "function", function: { name: "schedule_task", description: "Fix a task at a time (\"work on X tomorrow 9 to 11\"). The planner fits everything else around it.", parameters: S.obj({ id: S.int(), day: S.str("YYYY-MM-DD"), start: S.str("HH:mm, user's local time"), minutes: S.int() }, ["id", "day", "start", "minutes"]) } },
  { type: "function", function: { name: "unschedule_task", description: "Remove fixed times for a task so the planner places it again.", parameters: S.obj({ id: S.int() }, ["id"]) } },
  { type: "function", function: { name: "set_work_hours", description: "Change the hours when work can be planned, per weekday. Days not listed are off.", parameters: S.obj({ days: S.arr(S.obj({ weekday: S.int("1 = Monday … 7 = Sunday"), start: S.str("HH:mm"), end: S.str("HH:mm") }, ["weekday", "start", "end"])) }, ["days"]) } },
  { type: "function", function: { name: "get_plan", description: "The freshly computed plan after changes: planned work and deadlines at risk.", parameters: S.obj({ days: S.int("How many days ahead, default 7") }) } },
  { type: "function", function: { name: "find_meeting_times", description: "Find times for a meeting that clash with no calendar event. Planned work can move; each option says what would shift.", parameters: S.obj({ minutes: S.int(), from_day: S.str("YYYY-MM-DD"), to_day: S.str("YYYY-MM-DD"), earliest: S.str("HH:mm"), latest: S.str("HH:mm") }, ["minutes"]) } },
  { type: "function", function: { name: "check_capacity", description: "Could the user take on new work? Give your estimate of the hours and an optional deadline; returns free time and which tasks would slip.", parameters: S.obj({ hours: { type: "number" }, by_day: S.str("YYYY-MM-DD") }, ["hours"]) } },
  { type: "function", function: { name: "list_meetings", description: "Calendar events between two days (beyond the week in context), with refs usable by draft_emails.", parameters: S.obj({ from_day: S.str("YYYY-MM-DD"), to_day: S.str("YYYY-MM-DD") }, ["from_day", "to_day"]) } },
  { type: "function", function: { name: "draft_emails", description: "Prepare emails to the attendees of some events (to cancel or move them). The app adds the recipients; the user sends them from their own mail app.", parameters: S.obj({ event_refs: S.arr(S.str()), subject: S.str(), body: S.str("Signed with the user's first name") }, ["event_refs", "subject", "body"]) } },
  { type: "function", function: { name: "propose_calendar_event", description: "Offer to add an event to the user's calendar. It's added only when they confirm.", parameters: S.obj({ title: S.str(), day: S.str("YYYY-MM-DD"), start: S.str("HH:mm"), end: S.str("HH:mm"), attendee_emails: S.arr(S.str(), "Only emails the user gave you") }, ["title", "day", "start", "end"]) } },
];

// --- Helpers ----------------------------------------------------------------------------------------------

type Areas = Awaited<ReturnType<typeof listCategories>>;
type Projects = Awaited<ReturnType<typeof listProjects>>;

function resolveArea(areas: Areas, ref: number | string | undefined): number | null | "unknown" {
  if (ref === undefined || ref === "") return null;
  const found = typeof ref === "number" ? areas.find((a) => a.id === ref) : areas.find((a) => a.name.toLowerCase() === ref.trim().toLowerCase());
  return found ? found.id : "unknown";
}

function resolveProject(list: Projects, ref: number | string | undefined) {
  if (ref === undefined || ref === "") return null;
  const found = typeof ref === "number" ? list.find((p) => p.id === ref) : list.find((p) => p.name.toLowerCase() === ref.trim().toLowerCase());
  return found ?? "unknown";
}

function localInstant(user: User, d: string, hm: string) {
  return DateTime.fromISO(`${d}T${hm}`, { zone: user.timezone });
}

const snapshotTask = (t: Task): Record<string, unknown> => ({ ...t, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(), completedAt: t.completedAt?.toISOString() ?? null });

// --- Executors --------------------------------------------------------------------------------------------

type Exec = (ctx: ToolContext, args: unknown) => Promise<string>;

const executors: Record<string, Exec> = {
  async propose_plan(ctx, raw) {
    const a = z.object({
      areas: z.array(z.object({ name: z.string().trim().min(1).max(30), description: opt(z.string().max(200)) })).max(10).default([]),
      projects: z.array(z.object({ ref: z.string().max(20), name: z.string().trim().min(1).max(120), area: opt(z.string().max(60)), target_date: opt(day), notes: opt(z.string().max(2000)) })).max(40).default([]),
      tasks: z.array(z.object({ ...taskFields, project: opt(z.string().max(120)), area: opt(z.string().max(60)) })).max(150).default([]),
      links: z.array(z.object({ before: z.number().int(), after: z.number().int() })).max(100).default([]),
    }).parse(raw);
    ctx.proposal = {
      areas: a.areas,
      projects: a.projects.map((p) => ({ ref: p.ref, name: p.name, area: p.area, targetDate: p.target_date ?? null, notes: p.notes })),
      tasks: a.tasks.map((t) => ({ title: t.title, project: t.project, area: t.area, kind: t.kind, estimateMinutes: t.estimate_minutes ?? null, dueDate: t.due_date ?? null, hardDeadline: t.hard_deadline, priority: t.priority, energy: t.energy ?? null, notes: t.notes, people: t.people, repeat: t.repeat ?? null })),
      links: a.links.filter((l) => l.before !== l.after && a.tasks[l.before] && a.tasks[l.after]),
      status: "pending",
    };
    return `Shown to the user for review: ${a.areas.length} new areas, ${a.projects.length} projects, ${a.tasks.length} tasks. Nothing is created until they accept. Tell them briefly what you propose and that they can untick anything before accepting.`;
  },

  async add_tasks(ctx, raw) {
    const a = z.object({ tasks: z.array(z.object(taskFields)).min(1).max(30) }).parse(raw);
    const [areas, projectList, existing] = await Promise.all([listCategories(ctx.user.id), listProjects(ctx.user.id), listTasks(ctx.user.id)]);
    if (existing.length + a.tasks.length > MAX_TASKS) return `Error: the task limit (${MAX_TASKS}) would be exceeded.`;
    const out: string[] = [];
    let position = existing.length;
    for (const t of a.tasks) {
      const project = resolveProject(projectList, t.project);
      if (project === "unknown") {
        out.push(`"${t.title}": no project called ${JSON.stringify(t.project)}; create it first or leave project empty`);
        continue;
      }
      const area = project ? project.categoryId : resolveArea(areas, t.area);
      if (area === "unknown") {
        out.push(`"${t.title}": no area called ${JSON.stringify(t.area)}`);
        continue;
      }
      const kind = t.kind ?? "task";
      const [row] = await db
        .insert(tasks)
        .values({
          userId: ctx.user.id, projectId: project ? project.id : null, categoryId: area, title: t.title, notes: t.notes ?? "", kind,
          estimateMinutes: kind === "reminder" ? null : (t.estimate_minutes ?? null), dueDate: t.due_date ?? null, hardDeadline: t.hard_deadline ?? false,
          priority: t.priority ?? "normal", energy: t.energy ?? null, people: t.people ?? [], repeat: t.repeat ?? null, position: position++,
        })
        .returning({ id: tasks.id });
      ctx.undo.push({ op: "deleteTask", id: row.id });
      ctx.actions.push(`Added ${kind === "reminder" ? "reminder" : "task"} "${t.title}"`);
      out.push(`added #${row.id} "${t.title}"`);
    }
    ctx.changed = true;
    return out.join("; ");
  },

  async update_task(ctx, raw) {
    const a = z.object({ id: z.number().int(), ...taskFields, title: opt(z.string().trim().min(1).max(200)) }).parse(raw);
    const task = await getTask(ctx.user.id, a.id);
    if (!task) return "Error: no such task.";
    const fields: Partial<Task> = {};
    if (a.title !== undefined) fields.title = a.title;
    if (a.project !== undefined) {
      const project = resolveProject(await listProjects(ctx.user.id), a.project);
      if (project === "unknown") return `Error: no project called ${JSON.stringify(a.project)}.`;
      fields.projectId = project ? project.id : null;
      if (project) fields.categoryId = project.categoryId;
    }
    if (a.area !== undefined && !fields.projectId && !task.projectId) {
      const area = resolveArea(await listCategories(ctx.user.id), a.area);
      if (area === "unknown") return `Error: no area called ${JSON.stringify(a.area)}.`;
      fields.categoryId = area;
    }
    if (a.kind !== undefined) fields.kind = a.kind;
    if (a.estimate_minutes !== undefined) fields.estimateMinutes = a.estimate_minutes;
    if (a.due_date !== undefined) fields.dueDate = a.due_date;
    if (a.hard_deadline !== undefined) fields.hardDeadline = a.hard_deadline;
    if (a.priority !== undefined) fields.priority = a.priority;
    if (a.energy !== undefined) fields.energy = a.energy;
    if (a.notes !== undefined) fields.notes = a.notes;
    if (a.people !== undefined) fields.people = a.people;
    if (a.repeat !== undefined) fields.repeat = a.repeat;
    if (!Object.keys(fields).length) return "Nothing to change.";
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) before[k] = task[k as keyof Task];
    await db.update(tasks).set({ ...fields, updatedAt: new Date() }).where(and(eq(tasks.id, task.id), eq(tasks.userId, ctx.user.id)));
    ctx.undo.push({ op: "patchTask", id: task.id, fields: before });
    ctx.actions.push(`Updated "${fields.title ?? task.title}"`);
    ctx.changed = true;
    return "updated";
  },

  async set_task_status(ctx, raw) {
    const a = z.object({ id: z.number().int(), status: z.enum(["done", "good_enough", "dropped", "open"]), residue: opt(z.string().max(300)) }).parse(raw);
    const task = await getTask(ctx.user.id, a.id);
    if (!task) return "Error: no such task.";
    const r = await applyStatus(ctx.user.id, task, a.status, a.residue, ctx.user.timezone);
    if (r.error) return `Error: ${r.error}`;
    ctx.undo.push({ op: "patchTask", id: task.id, fields: { status: task.status, residue: task.residue, completedAt: task.completedAt?.toISOString() ?? null } });
    if (r.nextId) ctx.undo.push({ op: "deleteTask", id: r.nextId });
    const word = { done: "Done", good_enough: "Good enough", dropped: "Dropped", open: "Reopened" }[a.status];
    ctx.actions.push(`${word}: "${task.title}"${a.status === "good_enough" && a.residue ? ` (left: ${a.residue})` : ""}`);
    if (a.status === "done" || a.status === "good_enough") ctx.celebrated = true;
    ctx.changed = true;
    return r.nextId ? `${word}. Created the next occurrence (#${r.nextId}).` : word;
  },

  async delete_tasks(ctx, raw) {
    const a = z.object({ ids: z.array(z.number().int()).min(1).max(50) }).parse(raw);
    const rows = await ownedTasks(ctx.user.id, a.ids);
    if (!rows.length) return "Error: none of those tasks exist.";
    const links = await db.select().from(taskLinks).where(and(eq(taskLinks.userId, ctx.user.id), inArray(taskLinks.fromTaskId, rows.map((r) => r.id))));
    const links2 = await db.select().from(taskLinks).where(and(eq(taskLinks.userId, ctx.user.id), inArray(taskLinks.toTaskId, rows.map((r) => r.id))));
    const allLinks = [...new Map([...links, ...links2].map((l) => [l.id, l])).values()];
    for (const t of rows) {
      ctx.undo.push({ op: "restoreTask", row: snapshotTask(t), links: allLinks.filter((l) => l.fromTaskId === t.id || l.toTaskId === t.id) });
      ctx.actions.push(`Removed "${t.title}"`);
    }
    await db.delete(tasks).where(and(eq(tasks.userId, ctx.user.id), inArray(tasks.id, rows.map((r) => r.id))));
    ctx.changed = true;
    return `deleted ${rows.length}`;
  },

  async create_project(ctx, raw) {
    const a = z.object({ name: z.string().trim().min(1).max(120), area: opt(z.union([z.number().int(), z.string().max(60)])), target_date: opt(day), notes: opt(z.string().max(2000)) }).parse(raw);
    const list = await listProjects(ctx.user.id);
    if (list.length >= MAX_PROJECTS) return `Error: the project limit (${MAX_PROJECTS}) is reached.`;
    const existing = list.find((p) => p.name.toLowerCase() === a.name.toLowerCase());
    if (existing) return `A project called "${existing.name}" already exists (#${existing.id}).`;
    const area = resolveArea(await listCategories(ctx.user.id), a.area);
    if (area === "unknown") return `Error: no area called ${JSON.stringify(a.area)}.`;
    const [row] = await db.insert(projects).values({ userId: ctx.user.id, name: a.name, categoryId: area, targetDate: a.target_date ?? null, notes: a.notes ?? "", position: list.length }).returning({ id: projects.id });
    ctx.undo.push({ op: "deleteProject", id: row.id });
    ctx.actions.push(`Created project "${a.name}"`);
    return `created project #${row.id}`;
  },

  async update_project(ctx, raw) {
    const a = z.object({ id: z.number().int(), name: opt(z.string().trim().min(1).max(120)), area: opt(z.union([z.number().int(), z.string().max(60)])), target_date: opt(day), notes: opt(z.string().max(2000)), status: opt(z.enum(["active", "paused", "done"])) }).parse(raw);
    const [p] = await db.select().from(projects).where(and(eq(projects.id, a.id), eq(projects.userId, ctx.user.id))).limit(1);
    if (!p) return "Error: no such project.";
    const fields: Record<string, unknown> = {};
    if (a.name !== undefined) fields.name = a.name;
    if (a.target_date !== undefined) fields.targetDate = a.target_date;
    if (a.notes !== undefined) fields.notes = a.notes;
    if (a.status !== undefined) {
      fields.status = a.status;
      fields.completedAt = a.status === "done" ? (p.completedAt ?? new Date()) : null;
    }
    if (a.area !== undefined) {
      const area = resolveArea(await listCategories(ctx.user.id), a.area);
      if (area === "unknown") return `Error: no area called ${JSON.stringify(a.area)}.`;
      fields.categoryId = area;
    }
    const before: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      const v = p[k as keyof typeof p];
      before[k] = v instanceof Date ? v.toISOString() : v;
    }
    await db.update(projects).set(fields).where(eq(projects.id, p.id));
    if ("categoryId" in fields) await db.update(tasks).set({ categoryId: fields.categoryId as number | null }).where(and(eq(tasks.projectId, p.id), eq(tasks.userId, ctx.user.id)));
    ctx.undo.push({ op: "patchProject", id: p.id, fields: before });
    ctx.actions.push(`Updated project "${(fields.name as string) ?? p.name}"`);
    ctx.changed = true;
    return "updated";
  },

  async create_area(ctx, raw) {
    const a = z.object({ name: z.string().trim().min(1).max(30), description: opt(z.string().max(200)) }).parse(raw);
    const areas = await listCategories(ctx.user.id);
    const existing = areas.find((c) => c.name.toLowerCase() === a.name.toLowerCase());
    if (existing) return `An area called "${existing.name}" already exists (#${existing.id}).`;
    if (areas.length >= MAX_CATEGORIES) return `Error: the area limit (${MAX_CATEGORIES}) is reached.`;
    const [row] = await db.insert(categories).values({ userId: ctx.user.id, name: a.name, description: a.description ?? "", color: CATEGORY_PALETTE[areas.length % CATEGORY_PALETTE.length], position: areas.length }).returning({ id: categories.id });
    ctx.undo.push({ op: "deleteCategory", id: row.id });
    ctx.actions.push(`Created area "${a.name}"`);
    return `created area #${row.id}`;
  },

  async link_tasks(ctx, raw) {
    const a = z.object({ before: opt(z.number().int()), after: opt(z.number().int()), together: opt(z.array(z.number().int()).length(2)) }).parse(raw);
    const [from, to, kind] = a.together ? [a.together[0], a.together[1], "together" as const] : [a.before, a.after, "before" as const];
    if (from === undefined || to === undefined || from === to) return "Error: give two different tasks.";
    if ((await ownedTasks(ctx.user.id, [from, to])).length !== 2) return "Error: no such task.";
    const links = await listLinks(ctx.user.id);
    if (links.some((l) => (l.fromTaskId === from && l.toTaskId === to) || (l.fromTaskId === to && l.toTaskId === from))) return "They are already linked.";
    if (kind === "before" && wouldCycle(links, from, to)) return "Error: that would make a loop.";
    const [row] = await db.insert(taskLinks).values({ userId: ctx.user.id, fromTaskId: from, toTaskId: to, kind }).returning({ id: taskLinks.id });
    ctx.undo.push({ op: "deleteLink", id: row.id });
    ctx.actions.push(kind === "before" ? "Linked two tasks in order" : "Grouped two tasks");
    ctx.changed = true;
    return "linked";
  },

  async add_day_note(ctx, raw) {
    const a = z.object({ day: opt(day), note: z.string().trim().min(1).max(300), avoid_energy: opt(energy), skip_task_ids: opt(z.array(z.number().int()).max(50)), reserve_for_task_ids: opt(z.array(z.number().int()).max(50)), max_work_minutes: opt(z.number().int().min(0).max(24 * 60)) }).parse(raw);
    const ids = [...(a.skip_task_ids ?? []), ...(a.reserve_for_task_ids ?? [])];
    if (ids.length && (await ownedTasks(ctx.user.id, ids)).length !== new Set(ids).size) return "Error: one of those tasks doesn't exist.";
    const [row] = await db.insert(dayNotes).values({ userId: ctx.user.id, day: a.day ?? null, text: a.note, avoidEnergy: a.avoid_energy ?? null, skipTaskIds: a.skip_task_ids ?? [], reserveForTaskIds: a.reserve_for_task_ids ?? [], maxWorkMinutes: a.max_work_minutes ?? null }).returning({ id: dayNotes.id });
    ctx.undo.push({ op: "deleteNote", id: row.id });
    ctx.actions.push(a.day ? `Noted for ${DateTime.fromISO(a.day).toFormat("ccc d LLL")}: ${a.note}` : `Noted: ${a.note}`);
    ctx.changed = true;
    return "noted";
  },

  async remove_day_notes(ctx, raw) {
    const a = z.object({ ids: z.array(z.number().int()).min(1).max(50) }).parse(raw);
    const rows = await db.select().from(dayNotes).where(and(eq(dayNotes.userId, ctx.user.id), inArray(dayNotes.id, a.ids)));
    for (const r of rows) ctx.undo.push({ op: "restoreNote", row: { ...r, createdAt: r.createdAt.toISOString() } });
    await db.delete(dayNotes).where(and(eq(dayNotes.userId, ctx.user.id), inArray(dayNotes.id, a.ids)));
    if (rows.length) ctx.actions.push(`Forgot ${rows.length === 1 ? "a note" : `${rows.length} notes`}`);
    ctx.changed = true;
    return `removed ${rows.length}`;
  },

  async schedule_task(ctx, raw) {
    const a = z.object({ id: z.number().int(), day, start: time, minutes: z.number().int().min(5).max(12 * 60) }).parse(raw);
    const task = await getTask(ctx.user.id, a.id);
    if (!task) return "Error: no such task.";
    const start = localInstant(ctx.user, a.day, a.start);
    if (!start.isValid) return "Error: invalid time.";
    const [row] = await db.insert(pinnedBlocks).values({ userId: ctx.user.id, taskId: task.id, start: start.toJSDate(), end: start.plus({ minutes: a.minutes }).toJSDate() }).returning({ id: pinnedBlocks.id });
    ctx.undo.push({ op: "deletePinned", id: row.id });
    ctx.actions.push(`Set "${task.title}" for ${start.toFormat("ccc h:mm a")}`);
    ctx.changed = true;
    return "scheduled";
  },

  async unschedule_task(ctx, raw) {
    const a = z.object({ id: z.number().int() }).parse(raw);
    const rows = await db.select().from(pinnedBlocks).where(and(eq(pinnedBlocks.userId, ctx.user.id), eq(pinnedBlocks.taskId, a.id)));
    for (const r of rows) ctx.undo.push({ op: "restorePinned", row: { ...r, start: r.start.toISOString(), end: r.end.toISOString() } });
    await db.delete(pinnedBlocks).where(and(eq(pinnedBlocks.userId, ctx.user.id), eq(pinnedBlocks.taskId, a.id)));
    if (rows.length) ctx.actions.push("Let the planner place a task again");
    ctx.changed = true;
    return `removed ${rows.length} fixed times`;
  },

  async set_work_hours(ctx, raw) {
    const a = z.object({ days: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: time, end: time })).max(21) }).parse(raw);
    const weekly: Record<string, { start: string; end: string }[]> = { "1": [], "2": [], "3": [], "4": [], "5": [], "6": [], "7": [] };
    for (const d of a.days) if (d.end > d.start) weekly[String(d.weekday)].push({ start: d.start, end: d.end });
    ctx.undo.push({ op: "setWorkHours", weekly: ctx.user.workHours ?? null });
    await db.update(users).set({ workHours: weekly }).where(eq(users.id, ctx.user.id));
    ctx.user = { ...ctx.user, workHours: weekly };
    ctx.actions.push("Changed your work hours");
    ctx.changed = true;
    return "work hours saved";
  },

  async get_plan(ctx, raw) {
    const a = z.object({ days: opt(z.number().int().min(1).max(14)) }).parse(raw ?? {});
    const plan = ctx.changed ? (await replan(ctx.user, { notify: false })).plan : await freshPlan(ctx.user);
    ctx.changed = false;
    const tz = ctx.user.timezone;
    const titles = new Map((await listTasks(ctx.user.id)).map((t) => [t.id, t.title]));
    const until = Date.now() + (a.days ?? 7) * 86_400_000;
    const blocks = plan.blocks.filter((b) => Date.parse(b.start) < until).slice(0, 80).map((b) => `${DateTime.fromISO(b.start, { zone: tz }).toFormat("ccc yyyy-MM-dd HH:mm")}-${DateTime.fromISO(b.end, { zone: tz }).toFormat("HH:mm")} ${titles.get(b.taskId) ?? "?"}${b.pinned ? " (fixed)" : ""}`);
    if (plan.atRisk.length) ctx.concerned = true;
    const risk = plan.atRisk.map((r) => `${titles.get(r.taskId) ?? "?"}: ${r.reason === "late" ? `finishes after its due date${r.finishesAt ? ` (${DateTime.fromISO(r.finishesAt, { zone: tz }).toFormat("ccc d LLL")})` : ""}` : "does not fit in the next two weeks"}`);
    return JSON.stringify({ planned: blocks, at_risk: risk });
  },

  async find_meeting_times(ctx, raw) {
    const a = z.object({ minutes: z.number().int().min(10).max(8 * 60), from_day: opt(day), to_day: opt(day), earliest: opt(time), latest: opt(time) }).parse(raw);
    const { slots, titles } = await slotsFor(ctx.user, { minutes: a.minutes, fromDay: a.from_day, toDay: a.to_day, earliest: a.earliest, latest: a.latest });
    const tz = ctx.user.timezone;
    ctx.cards.push({ kind: "slots", items: slots.map((s) => ({ start: new Date(s.start).toISOString(), end: new Date(s.end).toISOString(), shifts: s.shifts.map((id) => titles.get(id) ?? "planned work") })) });
    if (!slots.length) return "No free time without clashing with an event in that window.";
    return JSON.stringify(slots.map((s) => ({ when: DateTime.fromMillis(s.start, { zone: tz }).toFormat("ccc yyyy-MM-dd HH:mm") + "-" + DateTime.fromMillis(s.end, { zone: tz }).toFormat("HH:mm"), would_shift: s.shifts.map((id) => titles.get(id)) })));
  },

  async check_capacity(ctx, raw) {
    const a = z.object({ hours: z.number().min(0.25).max(500), by_day: opt(day) }).parse(raw);
    const r = await capacityFor(ctx.user, Math.round(a.hours * 60), a.by_day ?? null);
    if (!r.newWorkFits || r.newlyAtRisk.length) ctx.concerned = true;
    return JSON.stringify({ free_work_hours_until_deadline: { until: r.until, hours: Math.round(r.freeMinutes / 6) / 10, after_existing_planned_work: true }, new_work_fits_before_deadline: r.newWorkFits, existing_tasks_that_would_slip: r.newlyAtRisk });
  },

  async list_meetings(ctx, raw) {
    const a = z.object({ from_day: day, to_day: day }).parse(raw);
    const tz = ctx.user.timezone;
    const from = DateTime.fromISO(a.from_day, { zone: tz }).startOf("day");
    let to = DateTime.fromISO(a.to_day, { zone: tz }).endOf("day");
    if (to.diff(from, "days").days > 31) to = from.plus({ days: 31 });
    const { rows } = await eventsWithRefs(ctx.user, from.toJSDate(), to.toJSDate(), ctx.refs);
    return JSON.stringify(rows);
  },

  async draft_emails(ctx, raw) {
    const a = z.object({ event_refs: z.array(z.string().max(10)).min(1).max(20), subject: z.string().trim().min(1).max(200), body: z.string().trim().min(1).max(1500) }).parse(raw);
    const mine = new Set((await listAccounts(ctx.user.id)).map((acc) => acc.email.toLowerCase()));
    const items: { label: string; href: string; count: number }[] = [];
    for (const ref of a.event_refs) {
      const e = ctx.refs.get(ref);
      if (!e) continue;
      const to = [...new Set(e.attendees.map((x) => x.email.toLowerCase()).filter((x) => !mine.has(x) && !x.endsWith("resource.calendar.google.com")))];
      if (!to.length) continue;
      const href = `mailto:${to.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(a.subject)}&body=${encodeURIComponent(a.body)}`;
      items.push({ label: e.title, href, count: to.length });
    }
    if (!items.length) return "None of those events have other attendees to email.";
    ctx.cards.push({ kind: "emails", items });
    return `Prepared ${items.length} email draft${items.length > 1 ? "s" : ""}; the user opens each in their mail app and sends it. Do not say they were sent.`;
  },

  async propose_calendar_event(ctx, raw) {
    const a = z.object({ title: z.string().trim().min(1).max(200), day, start: time, end: time, attendee_emails: opt(z.array(z.string().email()).max(20)) }).parse(raw);
    const s = localInstant(ctx.user, a.day, a.start);
    const e = localInstant(ctx.user, a.day, a.end);
    if (!s.isValid || !e.isValid || e <= s) return "Error: invalid time.";
    ctx.cards.push({ kind: "event", title: a.title, start: s.toISO()!, end: e.toISO()!, attendees: a.attendee_emails ?? [], status: "pending" });
    return "Shown to the user with an Add to calendar button; it is not on the calendar until they press it.";
  },
};

export async function runTool(ctx: ToolContext, name: string, argsJson: string): Promise<string> {
  const exec = executors[name];
  if (!exec) return `Error: unknown tool ${name}.`;
  let args: unknown;
  try {
    args = argsJson ? JSON.parse(argsJson) : {};
  } catch {
    return "Error: arguments were not valid JSON.";
  }
  try {
    return await exec(ctx, args);
  } catch (err) {
    if (err instanceof z.ZodError) return `Error: ${err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 400)}`;
    throw err;
  }
}

export const TOOL_STATUS: Record<string, string> = {
  propose_plan: "Sorting it all out",
  add_tasks: "Adding",
  update_task: "Updating",
  set_task_status: "Updating",
  delete_tasks: "Removing",
  create_project: "Creating a project",
  update_project: "Updating a project",
  create_area: "Creating an area",
  link_tasks: "Linking",
  add_day_note: "Noting that",
  remove_day_notes: "Forgetting that",
  schedule_task: "Scheduling",
  unschedule_task: "Rescheduling",
  set_work_hours: "Updating your hours",
  get_plan: "Checking the plan",
  find_meeting_times: "Looking for free time",
  check_capacity: "Checking your capacity",
  list_meetings: "Looking at your calendar",
  draft_emails: "Drafting emails",
  propose_calendar_event: "Preparing an event",
};

export { todayIn };
