import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordDori, voiceRoomLeft } from "@/lib/dori/usage";
import { logError } from "@/lib/log";
import { rateLimitKey, RateLimitError } from "@/lib/rate-limit";

export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024; // a couple of minutes of compressed speech

/**
 * Speech to text for Dori's microphone, through ElevenLabs Scribe. Only the user's own recording is sent; it
 * contains whatever they say. Without ELEVENLABS_API_KEY the browser's own recognition is used instead.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.doriConsentAt) return NextResponse.json({ error: "Turn Dori on first." }, { status: 403 });
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Voice input isn't set up on this instance." }, { status: 501 });
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
  const seconds = Math.min(600, Math.max(1, Number(form?.get("seconds")) || audio.size / 16_000));

  const body = new FormData();
  body.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
  body.append("file", audio, "speech.webm");
  body.append("tag_audio_events", "false");
  try {
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", { method: "POST", headers: { "xi-api-key": key }, body, signal: AbortSignal.timeout(25_000) });
    const data = (await res.json().catch(() => ({}))) as { text?: string; language_code?: string; detail?: { message?: string } | string };
    if (!res.ok) {
      logError("elevenlabs stt", new Error(`${res.status} ${typeof data.detail === "string" ? data.detail : (data.detail?.message ?? "")}`));
      return NextResponse.json({ error: "Couldn't understand the recording. Try again or type it." }, { status: 502 });
    }
    await recordDori(user.id, { voiceSeconds: seconds });
    return NextResponse.json({ text: (data.text ?? "").trim(), lang: data.language_code ?? null });
  } catch (err) {
    logError("elevenlabs stt", err);
    return NextResponse.json({ error: "Voice input is unavailable right now. Typing still works." }, { status: 502 });
  }
}
