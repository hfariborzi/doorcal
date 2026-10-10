/** Reverses what Dori did in one message, newest change first. */
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db, categories, dayNotes, doriActions, pinnedBlocks, projects, taskLinks, tasks, users, type UndoOp } from "@/db";

const DATE_KEYS = new Set(["createdAt", "updatedAt", "completedAt", "start", "end"]);
function revive(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = DATE_KEYS.has(k) && typeof v === "string" ? new Date(v) : v;
  return out;
}

async function apply(userId: number, op: UndoOp) {
  switch (op.op) {
    case "deleteTask":
      await db.delete(tasks).where(and(eq(tasks.id, op.id), eq(tasks.userId, userId)));
      break;
    case "restoreTask": {
      const row = revive(op.row) as typeof tasks.$inferInsert;
      if (row.userId !== userId) return;
      await db.insert(tasks).values(row).onConflictDoNothing();
      for (const l of op.links) {
        const link = l as typeof taskLinks.$inferInsert;
        const present = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, userId), inArray(tasks.id, [link.fromTaskId, link.toTaskId])));
        if (present.length === 2) await db.insert(taskLinks).values(link).onConflictDoNothing();
      }
      break;
    }
    case "patchTask":
      await db.update(tasks).set({ ...(revive(op.fields) as Partial<typeof tasks.$inferInsert>), updatedAt: new Date() }).where(and(eq(tasks.id, op.id), eq(tasks.userId, userId)));
      break;
    case "deleteProject":
      await db.delete(projects).where(and(eq(projects.id, op.id), eq(projects.userId, userId)));
      break;
    case "patchProject": {
      const fields = revive(op.fields) as Partial<typeof projects.$inferInsert>;
      await db.update(projects).set(fields).where(and(eq(projects.id, op.id), eq(projects.userId, userId)));
      if ("categoryId" in fields) await db.update(tasks).set({ categoryId: fields.categoryId ?? null }).where(and(eq(tasks.projectId, op.id), eq(tasks.userId, userId)));
      break;
    }
    case "deleteCategory":
      await db.delete(categories).where(and(eq(categories.id, op.id), eq(categories.userId, userId)));
      break;
    case "deleteLink":
      await db.delete(taskLinks).where(and(eq(taskLinks.id, op.id), eq(taskLinks.userId, userId)));
      break;
    case "deleteNote":
      await db.delete(dayNotes).where(and(eq(dayNotes.id, op.id), eq(dayNotes.userId, userId)));
      break;
    case "restoreNote": {
      const row = revive(op.row) as typeof dayNotes.$inferInsert;
      if (row.userId === userId) await db.insert(dayNotes).values(row).onConflictDoNothing();
      break;
    }
    case "deletePinned":
      await db.delete(pinnedBlocks).where(and(eq(pinnedBlocks.id, op.id), eq(pinnedBlocks.userId, userId)));
      break;
    case "restorePinned": {
      const row = revive(op.row) as typeof pinnedBlocks.$inferInsert;
      if (row.userId === userId) await db.insert(pinnedBlocks).values(row).onConflictDoNothing();
      break;
    }
    case "setWorkHours":
      await db.update(users).set({ workHours: op.weekly }).where(eq(users.id, userId));
      break;
  }
}

/** Undo every not-yet-undone change recorded for a message. Returns how many changes were reversed. */
export async function undoMessage(userId: number, messageId: number): Promise<number> {
  const rows = await db.select().from(doriActions).where(and(eq(doriActions.userId, userId), eq(doriActions.messageId, messageId), isNull(doriActions.undoneAt)));
  let n = 0;
  for (const r of rows.reverse()) {
    for (const op of [...r.undo].reverse()) {
      await apply(userId, op);
      n++;
    }
    await db.update(doriActions).set({ undoneAt: new Date() }).where(eq(doriActions.id, r.id));
  }
  return n;
}
