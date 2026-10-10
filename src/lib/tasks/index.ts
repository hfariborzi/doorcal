/**
 * Projects, tasks and links for one user. Everything here is scoped by user id; the actions in
 * src/app/dashboard/actions.ts do the validation and the writes.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, projects, taskLinks, tasks, type Project, type Task, type TaskLink } from "@/db";

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
