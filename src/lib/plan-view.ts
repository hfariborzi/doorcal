/**
 * Planned work in a time range, as the calendar and the apps show it: the current plan plus pinned history (blocks
 * that already happened, or were marked done), each with its task's state. Used by /api/plan and /api/v1.
 */
import { and, eq, gt, lt } from "drizzle-orm";
import { db, pinnedBlocks, type TaskStatus, type User } from "@/db";
import { freshPlan } from "@/lib/planner";
import { listTasks } from "@/lib/tasks";

export type BlockView = {
  taskId: number;
  start: string;
  end: string;
  pinned: boolean;
  title: string;
  categoryId: number | null;
  priority: "high" | "normal" | "low";
  dueDate: string | null;
  risk: "late" | "unplaced" | null;
  status: TaskStatus;
  progress: number;
  past: boolean;
};

export async function planBlocks(user: User, start: number, end: number): Promise<BlockView[]> {
  const [plan, tasks, history] = await Promise.all([
    freshPlan(user),
    listTasks(user.id),
    db.select().from(pinnedBlocks).where(and(eq(pinnedBlocks.userId, user.id), lt(pinnedBlocks.start, new Date(end)), gt(pinnedBlocks.end, new Date(start)))),
  ]);
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const risk = new Map(plan.atRisk.map((r) => [r.taskId, r.reason]));
  return [
    ...plan.blocks,
    ...history
      .filter((h) => !plan.blocks.some((b) => b.taskId === h.taskId && Date.parse(b.start) === h.start.getTime()))
      .map((h) => ({ taskId: h.taskId, start: h.start.toISOString(), end: h.end.toISOString(), pinned: true })),
  ]
    .filter((b) => Date.parse(b.end) > start && Date.parse(b.start) < end && byId.has(b.taskId))
    .map((b) => {
      const t = byId.get(b.taskId)!;
      const past = Date.parse(b.end) <= Date.now();
      return {
        ...b,
        title: t.title,
        categoryId: t.categoryId,
        priority: t.priority,
        dueDate: t.dueDate,
        risk: past || t.status !== "open" ? null : ((risk.get(b.taskId) as BlockView["risk"]) ?? null),
        status: t.status,
        progress: t.progress,
        past,
      };
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}

/** How a block shows: to do, passed without being done, partly done, good enough, or done. */
export function blockState(b: Pick<BlockView, "status" | "progress" | "past">): "open" | "missed" | "partly" | "good_enough" | "done" {
  if (b.status === "done") return "done";
  if (b.status === "good_enough") return "good_enough";
  if (b.progress > 0) return "partly";
  return b.past ? "missed" : "open";
}
