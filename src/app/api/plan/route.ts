import { NextResponse, after, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatches } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";
import { freshPlan } from "@/lib/planner";
import { listTasks } from "@/lib/tasks";
import { and, eq, gt, lt } from "drizzle-orm";
import { db, pinnedBlocks } from "@/db";

// Recomputing the plan reads free/busy from every connected calendar.
export const maxDuration = 30;

/** Planned work blocks in a range, with task titles, for the calendar view. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const start = Date.parse(req.nextUrl.searchParams.get("start") ?? "");
  const end = Date.parse(req.nextUrl.searchParams.get("end") ?? "");
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  try {
    const [plan, tasks, history] = await Promise.all([
      freshPlan(user),
      listTasks(user.id),
      // Pinned blocks in range, including ones in the past: what was planned, and done or not, stays on the calendar.
      db.select().from(pinnedBlocks).where(and(eq(pinnedBlocks.userId, user.id), lt(pinnedBlocks.start, new Date(end)), gt(pinnedBlocks.end, new Date(start)))),
    ]);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const risk = new Map(plan.atRisk.map((r) => [r.taskId, r.reason]));
    after(() => ensureWatches(user.id).catch((err) => logError("watches", err)));
    return NextResponse.json(
      {
        blocks: [
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
              risk: past || t.status !== "open" ? null : (risk.get(b.taskId) ?? null),
              status: t.status,
              progress: t.progress,
              past,
            };
          }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logError("plan", err);
    return NextResponse.json({ error: "Could not load the plan" }, { status: 500 });
  }
}
