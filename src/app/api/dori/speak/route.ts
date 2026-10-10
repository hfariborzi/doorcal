import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { speechAvailable, synthesize } from "@/lib/ai/audio";
import { getCurrentUser } from "@/lib/auth";
import { recordDori, speechRoomLeft } from "@/lib/dori/usage";
import { logError } from "@/lib/log";
import { rateLimitKey, RateLimitError } from "@/lib/rate-limit";

export const maxDuration = 30;

const bodySchema = z.object({ text: z.string().trim().min(1).max(2500), lang: z.string().max(20).nullish() });

/**
 * Reads one of Dori's replies aloud: ElevenLabs Eleven v4 Turbo through OpenRouter, zero-data-retention
 * endpoints only. Returns MP3. Without OpenRouter configured, the panel uses the browser's voices instead.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.doriConsentAt) return NextResponse.json({ error: "Turn Dori on first." }, { status: 403 });
  if (!speechAvailable()) return NextResponse.json({ error: "Read-aloud isn't set up on this instance." }, { status: 501 });
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  // Bullets and the hidden language tag aren't meant to be spoken.
  const text = parsed.data.text.replace(/•/g, "").replace(/\[\[lang:[^\]]*\]\]/g, "").trim();
  try {
    await rateLimitKey(`speak:${user.id}`, 40, 300);
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    throw err;
  }
  if (!(await speechRoomLeft(user.id, text.length))) return NextResponse.json({ error: "Dori's voice is resting until tomorrow." }, { status: 429 });
  try {
    const audio = await synthesize(text, parsed.data.lang);
    await recordDori(user.id, { speechChars: text.length });
    return new NextResponse(audio, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  } catch (err) {
    logError("speak", err);
    return NextResponse.json({ error: "Couldn't read that aloud." }, { status: 502 });
  }
}
