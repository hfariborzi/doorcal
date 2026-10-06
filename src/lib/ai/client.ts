/**
 * Minimal client for any OpenAI-compatible chat-completions endpoint (OpenAI, Groq, Mistral, OpenRouter,
 * Gemini's compatibility endpoint, self-hosted vLLM or Ollama). Classification is a tiny task, so the
 * cheapest model the provider offers is enough. Configured with AI_BASE_URL, AI_API_KEY and AI_MODEL.
 *
 * The response is always parsed against a schema before use: event titles are untrusted text, and a model
 * can only ever answer with ids from the list it was given.
 */
import type { z } from "zod";

const TIMEOUT_MS = 20_000;

export function aiConfigured() {
  return !!(process.env.AI_API_KEY && process.env.AI_MODEL);
}

export const AI_PROVIDER_NAME = process.env.AI_PROVIDER_NAME || "the configured AI provider";

function config() {
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!key || !model) throw new Error("AI_API_KEY / AI_MODEL are not set");
  return { key, model, baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "") };
}

export type Usage = { inputTokens: number; outputTokens: number };

type Completion = {
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
};

async function complete(body: Record<string, unknown>): Promise<{ status: number; data: Completion }> {
  const { key, baseUrl } = config();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  let data: Completion = {};
  try {
    data = text ? (JSON.parse(text) as Completion) : {};
  } catch {
    data = { error: { message: text.slice(0, 200) } };
  }
  return { status: res.status, data };
}

/**
 * Ask for JSON matching `schema`. Tries the provider's JSON-schema mode first; providers that don't
 * support it fall back to plain JSON mode with the schema spelled out in the prompt.
 */
export async function completeJson<T>(opts: {
  name: string;
  schema: z.ZodType<T>;
  jsonSchema: Record<string, unknown>;
  system: string;
  user: string;
  maxTokens: number;
}): Promise<{ data: T; usage: Usage }> {
  const { model } = config();
  const base = {
    model,
    temperature: 0,
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  let { status, data } = await complete({
    ...base,
    response_format: { type: "json_schema", json_schema: { name: opts.name, schema: opts.jsonSchema, strict: true } },
  });
  if (status === 400) {
    ({ status, data } = await complete({
      ...base,
      messages: [
        { role: "system", content: `${opts.system}\n\nAnswer with JSON only, matching this JSON schema:\n${JSON.stringify(opts.jsonSchema)}` },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_object" },
    }));
  }
  if (status >= 300) throw new Error(`AI provider ${status}: ${data.error?.message ?? "request failed"}`);
  const content = data.choices?.[0]?.message?.content ?? "";
  const json = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("AI provider returned something other than JSON");
  }
  const result = opts.schema.safeParse(parsed);
  if (!result.success) throw new Error(`AI answer did not match the expected shape: ${result.error.issues[0]?.message ?? "invalid"}`);
  return {
    data: result.data,
    usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: data.usage?.completion_tokens ?? 0 },
  };
}
