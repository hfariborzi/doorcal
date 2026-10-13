import { z } from "zod";
import { json, withDevice } from "@/lib/api-v1";
import { listCategories } from "@/lib/labels";
import { toPalette } from "@/lib/palette";
import { listTasks } from "@/lib/tasks";
import { quickAddTask } from "@/lib/task-ops";

/** Open tasks for the Tasks widget: due ones first, then by the person's own order. */
export async function GET(req: Request) {
  return withDevice(req, "tasks", async (user) => {
    const [tasks, categories] = await Promise.all([listTasks(user.id), listCategories(user.id)]);
    const open = tasks
      .filter((t) => t.status === "open")
      .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.position - b.position)
      .slice(0, 30)
      .map((t) => ({
        id: t.id,
        title: t.title,
        kind: t.kind,
        dueDate: t.dueDate,
        progress: t.progress,
        priority: t.priority,
        color: toPalette(categories.find((c) => c.id === t.categoryId)?.color ?? "#e11d48"),
      }));
    return json({ tasks: open });
  });
}

const addSchema = z.object({ title: z.string().trim().min(1).max(300), kind: z.enum(["task", "reminder"]).default("task") });

/** Quick add from the app's shortcut window or a widget. */
export async function POST(req: Request) {
  return withDevice(req, "tasks add", async (user) => {
    const parsed = addSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Write what to add" }, 400);
    const r = await quickAddTask(user, parsed.data.title, parsed.data.kind);
    return r.error ? json({ error: r.error }, 400) : json({ id: r.id });
  });
}
