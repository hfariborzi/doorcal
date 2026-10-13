import { z } from "zod";
import { json, withDevice } from "@/lib/api-v1";
import { markBlockFor } from "@/lib/task-ops";

const schema = z.object({
  taskId: z.number().int(),
  start: z.string(),
  end: z.string(),
  state: z.discriminatedUnion("status", [
    z.object({ status: z.literal("done") }),
    z.object({ status: z.literal("not_done") }),
    z.object({ status: z.literal("partly"), progress: z.number().min(5).max(95) }),
    z.object({ status: z.literal("good_enough"), residue: z.string().trim().min(1).max(300) }),
  ]),
});

/** "How did it go?" from a notification or a widget. */
export async function POST(req: Request) {
  return withDevice(req, "block mark", async (user) => {
    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const { taskId, start, end, state } = parsed.data;
    const r = await markBlockFor(user, taskId, start, end, state);
    return r.error ? json({ error: r.error }, 400) : json({ ok: true });
  });
}
