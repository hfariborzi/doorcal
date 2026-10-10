/** Turns an accepted brain-dump proposal into areas, projects, tasks and links, recording how to undo it. */
import { db, categories, projects, taskLinks, tasks, type DoriProposal, type UndoOp } from "@/db";
import { CATEGORY_PALETTE, MAX_CATEGORIES, listCategories } from "../labels";
import { MAX_PROJECTS, MAX_TASKS, listProjects, listTasks } from "../tasks";

export async function applyProposal(userId: number, p: DoriProposal, skipTasks: Set<number>): Promise<{ undo: UndoOp[]; summary: string[] }> {
  const undo: UndoOp[] = [];
  const summary: string[] = [];
  const areas = await listCategories(userId);
  const areaId = new Map(areas.map((a) => [a.name.toLowerCase(), a.id]));

  for (const a of p.areas) {
    if (areaId.has(a.name.toLowerCase()) || areaId.size >= MAX_CATEGORIES) continue;
    const [row] = await db.insert(categories).values({ userId, name: a.name, description: a.description ?? "", color: CATEGORY_PALETTE[areaId.size % CATEGORY_PALETTE.length], position: areaId.size }).returning({ id: categories.id });
    areaId.set(a.name.toLowerCase(), row.id);
    undo.push({ op: "deleteCategory", id: row.id });
    summary.push(`area "${a.name}"`);
  }

  const existingProjects = await listProjects(userId);
  const projectByName = new Map(existingProjects.map((x) => [x.name.toLowerCase(), x]));
  const projectByRef = new Map<string, { id: number; categoryId: number | null }>();
  let projectCount = existingProjects.length;
  // Only create projects that keep at least one task.
  const used = new Set(p.tasks.filter((_, i) => !skipTasks.has(i)).map((t) => t.project).filter(Boolean));
  for (const pr of p.projects) {
    if (!used.has(pr.ref) && !used.has(pr.name)) continue;
    const existing = projectByName.get(pr.name.toLowerCase());
    if (existing) {
      projectByRef.set(pr.ref, { id: existing.id, categoryId: existing.categoryId });
      continue;
    }
    if (projectCount >= MAX_PROJECTS) break;
    const categoryId = pr.area ? (areaId.get(pr.area.toLowerCase()) ?? null) : null;
    const [row] = await db.insert(projects).values({ userId, name: pr.name, categoryId, targetDate: pr.targetDate ?? null, notes: pr.notes ?? "", position: projectCount++ }).returning({ id: projects.id });
    projectByRef.set(pr.ref, { id: row.id, categoryId });
    undo.push({ op: "deleteProject", id: row.id });
    summary.push(`project "${pr.name}"`);
  }

  let position = (await listTasks(userId)).length;
  const taskIdByIndex = new Map<number, number>();
  let added = 0;
  for (const [i, t] of p.tasks.entries()) {
    if (skipTasks.has(i) || position >= MAX_TASKS) continue;
    const project = t.project ? (projectByRef.get(t.project) ?? (projectByName.get(t.project.toLowerCase()) ? { id: projectByName.get(t.project.toLowerCase())!.id, categoryId: projectByName.get(t.project.toLowerCase())!.categoryId } : null)) : null;
    const categoryId = project ? project.categoryId : t.area ? (areaId.get(t.area.toLowerCase()) ?? null) : null;
    const kind = t.kind ?? "task";
    const [row] = await db
      .insert(tasks)
      .values({
        userId, projectId: project?.id ?? null, categoryId, title: t.title, notes: t.notes ?? "", kind,
        estimateMinutes: kind === "reminder" ? null : (t.estimateMinutes ?? null), dueDate: t.dueDate ?? null, hardDeadline: t.hardDeadline ?? false,
        priority: t.priority ?? "normal", energy: t.energy ?? null, people: t.people ?? [], repeat: t.repeat ?? null, position: position++,
      })
      .returning({ id: tasks.id });
    taskIdByIndex.set(i, row.id);
    undo.push({ op: "deleteTask", id: row.id });
    added++;
  }
  if (added) summary.push(`${added} task${added > 1 ? "s" : ""}`);

  for (const l of p.links) {
    const from = taskIdByIndex.get(l.before);
    const to = taskIdByIndex.get(l.after);
    if (!from || !to || from === to) continue;
    const [row] = await db.insert(taskLinks).values({ userId, fromTaskId: from, toTaskId: to, kind: "before" }).onConflictDoNothing().returning({ id: taskLinks.id });
    if (row) undo.push({ op: "deleteLink", id: row.id });
  }
  return { undo, summary };
}
