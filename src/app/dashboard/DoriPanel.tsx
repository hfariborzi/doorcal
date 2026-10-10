"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarPlus, Check, CircleDashed, Loader2, Mail, Mic, Send, Square, Trash2, Undo2, Volume2, VolumeX, X } from "lucide-react";
import type { DoriCard, DoriMeta, DoriMood, DoriProposal } from "@/db/schema";
import { Dori } from "@/components/Dori";
import { acceptDoriProposal, clearDoriConversation, confirmDoriEvent, discardDoriProposal, dismissDoriEvent, setDoriEnabled, undoDoriMessage } from "./dori-actions";

type Msg = { id: number; role: "user" | "assistant"; content: string; meta: DoriMeta };
type State = { available: boolean; enabled: boolean; name: string; voice: boolean; news: number; messages: Msg[] };

/** Other parts of the dashboard open Dori with this event, optionally with text to send or to prefill. */
export const OPEN_DORI = "doorcal:open-dori";
/** Fired after Dori changed tasks or the plan, so the calendar and task views reload. */
export const DORI_CHANGED = "doorcal:dori-changed";
export type OpenDoriDetail = { send?: string; prefill?: string; mode?: "day" | "week" };

const SPEAK_KEY = "dori-speak";

function readSpeak() {
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}

function speak(text: string, lang?: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/•/g, ""));
  if (lang) {
    u.lang = lang;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));
    if (voice) u.voice = voice;
  }
  window.speechSynthesis.speak(u);
}

type SpeechRecognitionLike = { lang: string; interimResults: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function browserRecognizer(): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return C ? new C() : null;
}

export function DoriPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<{ mood: DoriMood; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The header with this toggle only renders after the panel is opened, so reading storage here is safe.
  const [speakOn, setSpeakOn] = useState(() => typeof window !== "undefined" && readSpeak());
  const [recording, setRecording] = useState<"idle" | "recording" | "transcribing">("idle");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<{ stop: () => void } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/dori/messages");
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dori/messages")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: State | null) => !cancelled && d && setState(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [state?.messages.length, busy, open]);

  const send = useCallback(
    async (text: string, mode: "chat" | "day" | "week" = "chat") => {
      if (busy || (!text.trim() && mode === "chat")) return;
      setError(null);
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "";
      const optimistic: Msg = { id: -Date.now(), role: "user", content: mode === "day" ? "Day plan" : mode === "week" ? "Week plan" : text.trim(), meta: {} };
      setState((s) => (s ? { ...s, messages: [...s.messages, optimistic] } : s));
      setBusy({ mood: "thinking", text: "Thinking" });
      try {
        const res = await fetch("/api/dori/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, mode }) });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Dori couldn't answer just now.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as { type: string; mood?: DoriMood; text?: string; id?: number; meta?: DoriMeta };
            if (ev.type === "status") setBusy({ mood: ev.mood ?? "thinking", text: ev.text ?? "" });
            else if (ev.type === "error") setError(ev.text ?? "Something went wrong.");
            else if (ev.type === "reply") {
              const reply: Msg = { id: ev.id!, role: "assistant", content: ev.text ?? "", meta: ev.meta ?? {} };
              setState((s) => (s ? { ...s, news: 0, messages: [...s.messages, reply] } : s));
              if (readSpeak()) speak(reply.content, reply.meta.lang);
              if (reply.meta.actions?.length) {
                window.dispatchEvent(new Event(DORI_CHANGED));
                router.refresh();
              }
            }
          }
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [busy, router],
  );

  // Open from anywhere: buttons elsewhere dispatch OPEN_DORI.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDoriDetail>).detail ?? {};
      setOpen(true);
      if (d.prefill) {
        setInput(d.prefill);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (d.mode) void send("", d.mode);
      else if (d.send) void send(d.send);
    };
    window.addEventListener(OPEN_DORI, onOpen);
    return () => window.removeEventListener(OPEN_DORI, onOpen);
  }, [send]);

  async function startVoice() {
    setError(null);
    if (state?.voice && typeof MediaRecorder !== "undefined") {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        const started = Date.now();
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop());
          setRecording("transcribing");
          const form = new FormData();
          form.append("audio", new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
          form.append("seconds", String(Math.round((Date.now() - started) / 1000)));
          const res = await fetch("/api/dori/transcribe", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          setRecording("idle");
          if (!res.ok) return setError(data.error || "Couldn't hear that.");
          if (data.text) void send(data.text);
        };
        rec.start();
        recorderRef.current = { stop: () => rec.state !== "inactive" && rec.stop() };
        setRecording("recording");
        setTimeout(() => recorderRef.current?.stop(), 120_000);
      } catch {
        setError("Allow microphone access to talk to Dori.");
      }
      return;
    }
    const r = browserRecognizer();
    if (!r) return setError("Voice isn't supported in this browser. Typing works everywhere.");
    const lastLang = [...(state?.messages ?? [])].reverse().find((m) => m.meta.lang)?.meta.lang;
    r.lang = lastLang ?? navigator.language;
    r.interimResults = false;
    r.onresult = (e) => {
      const text = Array.from(e.results).map((x) => x[0].transcript).join(" ");
      if (text.trim()) void send(text);
    };
    r.onend = () => setRecording("idle");
    r.onerror = () => setRecording("idle");
    r.start();
    recorderRef.current = { stop: () => r.stop() };
    setRecording("recording");
  }

  const lastMood = [...(state?.messages ?? [])].reverse().find((m) => m.role === "assistant")?.meta.mood;
  const hour = new Date().getHours();
  const mood: DoriMood = busy?.mood ?? (hour < 6 || hour >= 22 ? "sleeping" : (lastMood ?? "happy"));
  const canVoice = typeof window !== "undefined" && (state?.voice || !!browserRecognizer());

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed right-4 bottom-4 z-40 grid h-16 w-16 place-items-center rounded-full border border-line bg-paper shadow-(--shadow-card) transition hover:scale-105 sm:right-6 sm:bottom-6"
          aria-label="Open Dori, your assistant"
          title="Dori"
        >
          <Dori mood={hour < 6 || hour >= 22 ? "sleeping" : "happy"} size={52} />
          {!!state?.news && <span className="absolute top-1 right-1 h-3 w-3 rounded-full border-2 border-paper bg-accent" aria-label="News from Dori" />}
        </button>
      )}

      {open && (
        <aside className="fixed inset-0 z-50 flex flex-col border-line bg-canvas shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[420px] sm:border-l" aria-label="Dori">
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <Dori mood={mood} size={44} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">Dori</div>
              <div className="truncate text-xs text-faint">{busy ? `${busy.text}…` : state?.enabled ? "Your assistant" : "Your assistant, off"}</div>
            </div>
            {state?.enabled && (
              <>
                <button
                  type="button"
                  className="btn-ghost p-2"
                  title={speakOn ? "Stop reading answers aloud" : "Read answers aloud"}
                  aria-label={speakOn ? "Stop reading answers aloud" : "Read answers aloud"}
                  onClick={() => {
                    const next = !speakOn;
                    setSpeakOn(next);
                    try {
                      localStorage.setItem(SPEAK_KEY, next ? "1" : "0");
                    } catch {}
                    if (!next) window.speechSynthesis?.cancel();
                  }}
                >
                  {speakOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
                <button
                  type="button"
                  className="btn-ghost p-2"
                  title="Clear the conversation"
                  aria-label="Clear the conversation"
                  onClick={async () => {
                    if (!confirm("Clear the conversation with Dori? Your tasks stay as they are.")) return;
                    await clearDoriConversation();
                    await load();
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button type="button" className="btn-ghost p-2" onClick={() => setOpen(false)} aria-label="Close Dori">
              <X size={18} />
            </button>
          </header>

          {!state ? (
            <div className="grid flex-1 place-items-center text-faint"><Loader2 className="animate-spin" /></div>
          ) : !state.available ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-muted">
              <Dori mood="sleeping" size={110} />
              Dori needs an AI provider, which this DoorCal instance hasn&apos;t set up. Tasks and planning still work.
            </div>
          ) : !state.enabled ? (
            <Consent onEnabled={load} />
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                {state.messages.length === 0 && (
                  <div className="flex flex-col items-center gap-3 py-6 text-center">
                    <Dori mood="happy" size={110} />
                    <p className="max-w-xs text-sm leading-relaxed text-muted">
                      Hi {state.name}! Tell me everything on your plate, in any order and any language. I&apos;ll sort it into
                      areas, projects and tasks, and keep your week realistic from then on.
                    </p>
                  </div>
                )}
                {state.messages.map((m) => (
                  <Message key={m.id} m={m} onChanged={async () => { await load(); window.dispatchEvent(new Event(DORI_CHANGED)); router.refresh(); }} />
                ))}
                {busy && (
                  <div className="flex items-center gap-2 text-sm text-faint"><Loader2 size={14} className="animate-spin" /> {busy.text}…</div>
                )}
                {error && <p className="rounded-lg border border-danger/25 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
              </div>

              <div className="border-t border-line px-3 pt-2.5 pb-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <Quick onClick={() => send("", "day")} disabled={!!busy}>Day plan</Quick>
                  <Quick onClick={() => send("", "week")} disabled={!!busy}>Week plan</Quick>
                  <Quick onClick={() => { setInput("Here's everything on my plate: "); inputRef.current?.focus(); }} disabled={!!busy}>Brain dump</Quick>
                </div>
                <form
                  className="flex items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send(input);
                  }}
                >
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      setInput(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void send(input);
                      }
                    }}
                    placeholder="Tell Dori anything…"
                    dir="auto"
                    className="input max-h-40 min-h-10 resize-none py-2.5"
                    maxLength={8000}
                    disabled={!!busy}
                  />
                  {canVoice && (
                    <button
                      type="button"
                      className={`btn h-10 w-10 shrink-0 p-0 ${recording === "recording" ? "bg-danger text-white" : "btn-secondary"}`}
                      onClick={() => (recording === "recording" ? recorderRef.current?.stop() : startVoice())}
                      disabled={!!busy || recording === "transcribing"}
                      aria-label={recording === "recording" ? "Stop recording" : "Talk to Dori"}
                      title={recording === "recording" ? "Stop" : "Talk"}
                    >
                      {recording === "transcribing" ? <Loader2 size={16} className="animate-spin" /> : recording === "recording" ? <Square size={14} /> : <Mic size={17} />}
                    </button>
                  )}
                  <button type="submit" className="btn-primary h-10 w-10 shrink-0 p-0" disabled={!!busy || !input.trim()} aria-label="Send">
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </>
          )}
        </aside>
      )}
    </>
  );
}

function Quick({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-muted hover:border-accent/50 hover:text-ink disabled:opacity-50">
      {children}
    </button>
  );
}

function Consent({ onEnabled }: { onEnabled: () => void }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-8 text-center">
      <Dori mood="happy" size={120} />
      <h2 className="mt-3 text-lg font-semibold">Meet Dori</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Dori sorts everything you tell her into areas, projects and tasks, plans them around your calendar, and
        answers questions like &ldquo;when can I meet Sam next week?&rdquo;
      </p>
      <div className="mt-5 rounded-xl border border-line bg-paper p-4 text-left text-xs leading-relaxed text-muted">
        <p className="font-medium text-ink">What turning her on means</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Your messages, your areas, projects and tasks, and the titles and times of your events for the coming week go to an AI model through OpenRouter, to OpenAI or Microsoft Azure OpenAI only, with zero data retention and no training on your data.</li>
          <li>Attendee names and emails, event descriptions and locations are never sent.</li>
          <li>If you use the microphone, your recording goes to ElevenLabs to be turned into text.</li>
          <li>Turning Dori off deletes the conversation and the notes she kept.</li>
        </ul>
        <p className="mt-2">Details in the <Link href="/privacy" className="link">privacy policy</Link>.</p>
      </div>
      <button
        type="button"
        className="btn-primary mt-5"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await setDoriEnabled(true);
          onEnabled();
        }}
      >
        {pending ? <Loader2 size={16} className="animate-spin" /> : null} Turn on Dori
      </button>
    </div>
  );
}

function Message({ m, onChanged }: { m: Msg; onChanged: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (fn: () => Promise<{ error?: string }>) => {
    setPending(true);
    setErr(null);
    const r = await fn();
    if (r.error) setErr(r.error);
    await onChanged();
    setPending(false);
  };

  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div dir="auto" className="max-w-[85%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2 text-sm whitespace-pre-wrap text-on-accent">{m.content}</div>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div dir="auto" className="max-w-[92%] rounded-2xl rounded-bl-md border border-line bg-paper px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-ink" lang={m.meta.lang}>
        {m.content}
      </div>
      {m.meta.actions?.length ? (
        <div className={`ml-1 space-y-0.5 text-xs ${m.meta.undone ? "text-faint line-through" : "text-muted"}`}>
          {m.meta.actions.slice(0, 12).map((a, i) => (
            <div key={i} className="flex items-start gap-1.5"><Check size={12} className="mt-0.5 shrink-0 text-accent-soft" /> {a}</div>
          ))}
          {m.meta.actions.length > 12 && <div className="pl-4">and {m.meta.actions.length - 12} more</div>}
          {m.meta.undoable && !m.meta.undone && (
            <button type="button" className="mt-1 inline-flex items-center gap-1 text-faint hover:text-ink" disabled={pending} onClick={() => act(() => undoDoriMessage(m.id))}>
              <Undo2 size={12} /> Undo
            </button>
          )}
          {m.meta.undone && <div className="no-underline">Undone</div>}
        </div>
      ) : null}
      {m.meta.proposal && <ProposalCard messageId={m.id} p={m.meta.proposal} onChanged={onChanged} />}
      {m.meta.cards?.map((c, i) => <Card key={i} card={c} index={i} messageId={m.id} act={act} pending={pending} />)}
      {err && <p className="text-xs text-danger">{err}</p>}
    </div>
  );
}

function Card({ card, index, messageId, act, pending }: { card: DoriCard; index: number; messageId: number; act: (fn: () => Promise<{ error?: string }>) => Promise<void>; pending: boolean }) {
  const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
  if (card.kind === "emails")
    return (
      <div className="space-y-1.5 rounded-xl border border-line bg-paper p-3">
        <p className="text-xs text-faint">Opens your mail app. Nothing is sent until you send it.</p>
        {card.items.map((it, i) => (
          <a key={i} href={it.href} className="btn-secondary w-full justify-start py-1.5 text-xs">
            <Mail size={14} /> <span className="truncate">Email {it.count} {it.count === 1 ? "person" : "people"}: {it.label}</span>
          </a>
        ))}
      </div>
    );
  if (card.kind === "event")
    return (
      <div className="rounded-xl border border-line bg-paper p-3 text-sm">
        <div className="font-medium text-ink">{card.title}</div>
        <div className="text-xs text-muted">{fmt(card.start)} – {new Date(card.end).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{card.attendees.length ? ` · ${card.attendees.length} invited` : ""}</div>
        {card.status === "pending" ? (
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-primary py-1 text-xs" disabled={pending} onClick={() => act(() => confirmDoriEvent(messageId, index))}><CalendarPlus size={14} /> Add to calendar</button>
            <button type="button" className="btn-ghost py-1 text-xs" disabled={pending} onClick={() => act(() => dismissDoriEvent(messageId, index))}>No thanks</button>
          </div>
        ) : (
          <div className="mt-1 text-xs text-faint">{card.status === "added" ? "Added to your calendar" : "Dismissed"}</div>
        )}
      </div>
    );
  if (card.kind === "slots" && card.items.length)
    return (
      <div className="space-y-1 rounded-xl border border-line bg-paper p-3 text-xs">
        {card.items.map((s, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium text-ink">{fmt(s.start)}</span>
            <span className="text-faint">{s.shifts.length ? `moves ${s.shifts.join(", ")}` : "free"}</span>
          </div>
        ))}
      </div>
    );
  return null;
}

function ProposalCard({ messageId, p, onChanged }: { messageId: number; p: DoriProposal; onChanged: () => Promise<void> }) {
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const toggle = (i: number) => setSkip((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i);
    else n.add(i);
    return n;
  });
  const done = p.status !== "pending";
  const groups: { title: string; items: number[] }[] = [];
  for (const pr of p.projects) groups.push({ title: pr.area ? `${pr.name} · ${pr.area}` : pr.name, items: p.tasks.map((t, i) => (t.project === pr.ref || t.project === pr.name ? i : -1)).filter((i) => i >= 0) });
  const claimed = new Set(groups.flatMap((g) => g.items));
  const loose = p.tasks.map((_, i) => i).filter((i) => !claimed.has(i));
  const byExisting = new Map<string, number[]>();
  const other: number[] = [];
  for (const i of loose) {
    const key = p.tasks[i].project || (p.tasks[i].area ? `${p.tasks[i].area}` : "");
    if (key) byExisting.set(key, [...(byExisting.get(key) ?? []), i]);
    else other.push(i);
  }
  for (const [k, items] of byExisting) groups.push({ title: k, items });
  if (other.length) groups.push({ title: "Other", items: other });
  const count = p.tasks.length - skip.size;

  return (
    <div className={`rounded-xl border border-line bg-paper p-3 text-sm ${done ? "opacity-70" : ""}`}>
      {p.areas.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-faint">New areas:</span>
          {p.areas.map((a) => <span key={a.name} className="rounded-full bg-hover px-2 py-0.5 text-muted">{a.name}</span>)}
        </div>
      )}
      <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
        {groups.filter((g) => g.items.length).map((g) => (
          <div key={g.title}>
            <div className="mb-1 text-xs font-semibold text-ink">{g.title}</div>
            {g.items.map((i) => {
              const t = p.tasks[i];
              return (
                <label key={i} className="flex items-start gap-2 py-0.5 text-xs text-muted">
                  <input type="checkbox" className="mt-0.5" checked={!skip.has(i)} disabled={done} onChange={() => toggle(i)} />
                  <span className={skip.has(i) ? "line-through" : ""}>
                    {t.title}
                    <span className="text-faint">
                      {t.kind === "reminder" ? " · reminder" : t.estimateMinutes ? ` · ${t.estimateMinutes >= 60 ? `${Math.round(t.estimateMinutes / 6) / 10} h` : `${t.estimateMinutes} min`}` : ""}
                      {t.dueDate ? ` · due ${t.dueDate}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
      {done ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-faint">{p.status === "accepted" ? <><Check size={12} /> Created</> : <><CircleDashed size={12} /> Discarded</>}</div>
      ) : (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="btn-primary py-1.5 text-xs"
            disabled={pending || count === 0}
            onClick={async () => {
              setPending(true);
              setErr(null);
              const r = await acceptDoriProposal(messageId, [...skip]);
              if (r.error) setErr(r.error);
              await onChanged();
              setPending(false);
            }}
          >
            {pending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Create {count} task{count === 1 ? "" : "s"}
          </button>
          <button type="button" className="btn-ghost py-1.5 text-xs" disabled={pending} onClick={async () => { await discardDoriProposal(messageId); await onChanged(); }}>
            Discard
          </button>
        </div>
      )}
      {err && <p className="mt-1 text-xs text-danger">{err}</p>}
    </div>
  );
}
