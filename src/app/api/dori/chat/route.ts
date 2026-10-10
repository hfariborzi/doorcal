import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { runTurn, type DoriEvent } from "@/lib/dori/agent";
import { logError } from "@/lib/log";
import { rateLimitKey, RateLimitError } from "@/lib/rate-limit";

// A turn can take several model calls and tool runs.
export const maxDuration = 60;

const bodySchema = z.object({ text: z.string().max(8000).default(""), mode: z.enum(["chat", "day", "week"]).default("chat") });

/** One message to Dori. Streams newline-delimited JSON events: status updates, then the reply. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  try {
    await rateLimitKey(`dori:${user.id}`, 20, 60);
  } catch (err) {
    if (err instanceof RateLimitError) return Response.json({ error: "Slow down a little and try again in a minute." }, { status: 429 });
    throw err;
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: DoriEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runTurn(user, parsed.data, emit);
      } catch (err) {
        logError("dori chat", err);
        emit({ type: "error", text: "Something went wrong. Please try again." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
