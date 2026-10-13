import { z } from "zod";
import { json, withDevice } from "@/lib/api-v1";
import { setStatusFor } from "@/lib/task-ops";

const schema = z.object({ status: z.enum(["open", "done", "good_enough", "dropped"]), residue: z.string().max(300).optional() });

/** Tick a task done (or good enough, or open again) from a widget. */
export async function POST(req: Request, ctx: RouteContext<"/api/v1/tasks/[id]/status">) {
  return withDevice(req, "task status", async (user) => {
    const id = Number((await ctx.params).id);
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!Number.isInteger(id) || !parsed.success) return json({ error: "Invalid request" }, 400);
    const r = await setStatusFor(user, id, parsed.data.status, parsed.data.residue);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true });
  });
}
