import { NextResponse, type NextRequest } from "next/server";
import { audioFormat, speechAvailable, transcribe } from "@/lib/ai/audio";
import { getCurrentUser } from "@/lib/auth";
import { recordDori, voiceRoomLeft } from "@/lib/dori/usage";
import { logError } from "@/lib/log";
import { rateLimitKey, RateLimitError } from "@/lib/rate-limit";

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // a couple of minutes of compressed speech

/**
 * Speech to text for Dori's microphone: ElevenLabs Scribe through OpenRouter, on zero-data-retention endpoints
 * only. Without OpenRouter configured, the panel uses the browser's own recognition instead.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.doriConsentAt) return NextResponse.json({ error: "Turn Dori on first." }, { status: 403 });
  if (!speechAvailable()) return NextResponse.json({ error: "Voice input isn't set up on this instance." }, { status: 501 });
  try {
    await rateLimitKey(`voice:${user.id}`, 30, 300);
  } catch (err) {
    if (err instanceof RateLimitError) return NextResponse.json({ error: "Too many recordings. Try again in a few minutes." }, { status: 429 });
    throw err;
  }
  if (!(await voiceRoomLeft(user.id))) return NextResponse.json({ error: "That's enough talking for today. Typing still works." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: "No audio received." }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "That recording is too long." }, { status: 413 });
  const format = audioFormat(audio.type || "audio/webm");
  if (!format) return NextResponse.json({ error: "This browser records in a format Dori can't read. Typing still works." }, { status: 415 });
  const lang = typeof form?.get("lang") === "string" ? (form!.get("lang") as string) : null;
  try {
    const { text, seconds } = await transcribe(await audio.arrayBuffer(), format, lang);
    await recordDori(user.id, { voiceSeconds: seconds });
    return NextResponse.json({ text });
  } catch (err) {
    logError("transcribe", err);
    return NextResponse.json({ error: "Couldn't understand the recording. Try again or type it." }, { status: 502 });
  }
}
