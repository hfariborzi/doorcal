import { NextResponse, after, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureWatches } from "@/lib/calendar/watch";
import { logError } from "@/lib/log";
import { freshPlan } from "@/lib/planner";
import { listTasks } from "@/lib/tasks";

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
    const [plan, tasks] = await Promise.all([freshPlan(user), listTasks(user.id)]);
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const risk = new Map(plan.atRisk.map((r) => [r.taskId, r.reason]));
    after(() => ensureWatches(user.id).catch((err) => logError("watches", err)));
    return NextResponse.json(
      {
        blocks: plan.blocks
          .filter((b) => Date.parse(b.end) > start && Date.parse(b.start) < end && byId.has(b.taskId))
          .map((b) => {
            const t = byId.get(b.taskId)!;
            return { ...b, title: t.title, categoryId: t.categoryId, priority: t.priority, dueDate: t.dueDate, risk: risk.get(b.taskId) ?? null };
          }),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    logError("plan", err);
    return NextResponse.json({ error: "Could not load the plan" }, { status: 500 });
  }
}
