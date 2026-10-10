/**
 * Projects, tasks and links for one user. Everything here is scoped by user id; the actions in
 * src/app/dashboard/actions.ts do the validation and the writes.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { DateTime } from "luxon";
import { db, projects, taskLinks, tasks, type Project, type Task, type TaskLink, type TaskStatus } from "@/db";
import { nextDue } from "../planner/core";
import { MAX_TASKS, transition } from "./core";

export * from "./core";

export async function listProjects(userId: number): Promise<Project[]> {
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.position), asc(projects.id));
}

export async function listTasks(userId: number): Promise<Task[]> {
  return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(asc(tasks.position), asc(tasks.id));
}

export async function listLinks(userId: number): Promise<TaskLink[]> {
  return db.select().from(taskLinks).where(eq(taskLinks.userId, userId));
}

export async function getProject(userId: number, id: number): Promise<Project | null> {
  const [p] = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  return p ?? null;
}

export async function getTask(userId: number, id: number): Promise<Task | null> {
  const [t] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  return t ?? null;
}

/** Tasks owned by the user among the given ids (for validating links). */
export async function ownedTasks(userId: number, ids: number[]): Promise<Task[]> {
  if (!ids.length) return [];
  return db.select().from(tasks).where(and(eq(tasks.userId, userId), inArray(tasks.id, ids)));
}

/**
 * Change a task's status (open, good enough with a residue, done, dropped). Completing a repeating task
 * creates its next occurrence. Returns the id of that new task, if any.
 */
export async function applyStatus(userId: number, task: Task, status: TaskStatus, residue: string | undefined, tz: string): Promise<{ error?: string; nextId?: number }> {
  const next = transition(task, status, residue);
  if ("error" in next) return { error: next.error };
  await db
    .update(tasks)
    .set({ status: next.status, residue: next.residue, completedAt: next.completed ? (task.completedAt ?? new Date()) : null, updatedAt: new Date() })
    .where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));
  const finishing = (status === "done" || status === "good_enough") && task.status === "open";
  if (!finishing || !task.repeat) return {};
  const count = (await listTasks(userId)).length;
  if (count >= MAX_TASKS) return {};
  const from = task.dueDate ?? DateTime.now().setZone(tz).toISODate()!;
  const [row] = await db
    .insert(tasks)
    .values({
      userId, projectId: task.projectId, categoryId: task.categoryId, title: task.title, notes: task.notes, kind: task.kind,
      estimateMinutes: task.estimateMinutes, dueDate: nextDue(task.repeat, from, tz), hardDeadline: task.hardDeadline,
      priority: task.priority, energy: task.energy, people: task.people, repeat: task.repeat, position: count,
    })
    .returning({ id: tasks.id });
  return { nextId: row.id };
}
