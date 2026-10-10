/**
 * Dori's voice, through OpenRouter: speech to text (ElevenLabs Scribe) and text to speech (ElevenLabs Eleven
 * v4 Turbo). Every request requires a zero-data-retention endpoint and no data collection, so recordings and
 * spoken replies are neither stored nor used for training. Available only when the AI provider is OpenRouter.
 */
const STT_MODEL = () => process.env.DORI_STT_MODEL || "elevenlabs/scribe-v2";
const TTS_MODEL = () => process.env.DORI_TTS_MODEL || "elevenlabs/eleven-v4-turbo";
const VOICE = () => process.env.DORI_VOICE || "sarah";
const PRIVACY = { zdr: true, data_collection: "deny" };

function base() {
  return (process.env.AI_BASE_URL || "").replace(/\/$/, "");
}

export function speechAvailable(): boolean {
  if (!process.env.AI_API_KEY) return false;
  try {
    return new URL(base()).hostname === "openrouter.ai";
  } catch {
    return false;
  }
}

const FORMATS: Record<string, string> = { webm: "webm", ogg: "ogg", mp4: "m4a", m4a: "m4a", "x-m4a": "m4a", mpeg: "mp3", mp3: "mp3", wav: "wav", "x-wav": "wav", aac: "aac", flac: "flac" };

/** The provider's format name for a recording's MIME type, e.g. "audio/webm;codecs=opus" → "webm". */
export function audioFormat(mime: string): string | null {
  const sub = mime.split(";")[0].split("/")[1]?.trim().toLowerCase() ?? "";
  return FORMATS[sub] ?? null;
}

const lang2 = (lang?: string | null) => (lang && /^[a-z]{2}/i.test(lang) ? lang.slice(0, 2).toLowerCase() : undefined);

export async function transcribe(audio: ArrayBuffer, format: string, lang?: string | null): Promise<{ text: string; seconds: number }> {
  const res = await fetch(`${base()}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://doorcal.com", "X-Title": "DoorCal" },
    body: JSON.stringify({ model: STT_MODEL(), input_audio: { data: Buffer.from(audio).toString("base64"), format }, ...(lang2(lang) ? { language: lang2(lang) } : {}), provider: PRIVACY }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = (await res.json().catch(() => ({}))) as { text?: string; usage?: { seconds?: number }; error?: { message?: string } };
  if (!res.ok || data.error) throw new Error(`transcription ${res.status}: ${data.error?.message ?? "failed"}`);
  return { text: (data.text ?? "").trim(), seconds: data.usage?.seconds ?? 0 };
}

export async function synthesize(text: string, lang?: string | null): Promise<ArrayBuffer> {
  const l = lang2(lang);
  const res = await fetch(`${base()}/audio/speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://doorcal.com", "X-Title": "DoorCal" },
    body: JSON.stringify({ model: TTS_MODEL(), input: text, voice: VOICE(), response_format: "mp3", provider: { ...PRIVACY, ...(l ? { options: { elevenlabs: { language_code: l } } } : {}) } }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`speech ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}
