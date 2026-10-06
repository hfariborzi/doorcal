"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import type { Priority } from "@/db/schema";
import { CATEGORY_PALETTE, PRIORITIES, PRIORITY_LABEL } from "@/lib/labels/core";
import { Switch } from "@/components/Switch";
import { applyProposal, proposeCategoriesAction, setAiConsent, type ProposedCategory } from "../actions";

type Draft = ProposedCategory & { include: boolean };

export function AiSettings({
  configured,
  providerName,
  enabled,
  usage,
  hasCategories,
}: {
  configured: boolean;
  providerName: string;
  enabled: boolean;
  usage: { events: number; requests: number };
  hasCategories: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Draft[] | null>(null);
  const [sampled, setSampled] = useState(0);
  const [mode, setMode] = useState<"replace" | "add">(hasCategories ? "add" : "replace");
  const [done, setDone] = useState(false);

  if (!configured) return null;

  return (
    <section className="card space-y-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="inline-flex items-center gap-2 font-semibold"><Sparkles size={16} className="text-accent-soft" /> AI categorisation</h2>
          <p className="mt-1 max-w-xl text-sm text-faint">
            Off by default. When on, events that no rule covers are sorted into your categories by a small AI model,
            and you can ask it to suggest a category list from your recent events.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={pending}
          label="AI categorisation"
          onChange={(on) => {
            if (on && !confirm(`Turn on AI categorisation?\n\nFor events no rule covers, DoorCal will send to ${providerName}: the event title, its length, whether it repeats, the number of attendees, whether it has a video link, and the calendar's name. Nothing else: no descriptions, no attendee names or emails, no booking details. You can turn this off at any time, which also removes the AI's labels.`)) return;
            setError(null);
            start(async () => {
              const r = await setAiConsent(on);
              if (r.error) setError(r.error);
              else router.refresh();
            });
          }}
        />
      </div>

      {enabled && (
        <>
          <p className="text-xs text-faint">
            Sent to {providerName}: title, length, repeats or not, attendee count, video link or not, calendar name.
            This month: {usage.events} events in {usage.requests} requests.
          </p>

          {!proposal && !done && (
            <button
              className="btn-secondary"
              disabled={pending}
              onClick={() => {
                setError(null);
                start(async () => {
                  const r = await proposeCategoriesAction();
                  if (r.error || !r.proposal) return setError(r.error ?? "No proposal");
                  setSampled(r.sampled ?? 0);
                  setProposal(r.proposal.map((c) => ({ ...c, include: true })));
                });
              }}
            >
              {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Suggest categories from my calendar
            </button>
          )}

          {proposal && (
            <div className="space-y-4 rounded-xl border border-line bg-well p-4">
              <p className="text-sm text-muted">
                Based on {sampled} recent events. Edit the names, untick what you don&apos;t want, then apply. The sampled
                events are labelled right away; new events are labelled as they appear.
              </p>
              <ul className="space-y-3">
                {proposal.map((c, i) => (
                  <li key={i} className={`flex flex-wrap items-start gap-3 ${c.include ? "" : "opacity-50"}`}>
                    <input type="checkbox" className="mt-2.5" checked={c.include} onChange={(e) => setProposal(proposal.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} aria-label="Include" />
                    <span className="mt-2 h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <input className="input w-44 py-1.5" value={c.name} maxLength={30} onChange={(e) => setProposal(proposal.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                        <select className="input w-32 py-1.5" value={c.defaultPriority} onChange={(e) => setProposal(proposal.map((x, j) => (j === i ? { ...x, defaultPriority: e.target.value as Priority } : x)))}>
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                          ))}
                        </select>
                        <select className="input w-28 py-1.5" value={c.color} onChange={(e) => setProposal(proposal.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)))} aria-label="Colour">
                          {CATEGORY_PALETTE.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <span className="text-xs text-faint">{c.events.length} events</span>
                      </div>
                      {c.sampleTitles.length > 0 && <p className="mt-1 truncate text-xs text-faint">e.g. {c.sampleTitles.join(" · ")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                {hasCategories && (
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <select className="input w-56 py-1.5" value={mode} onChange={(e) => setMode(e.target.value as "replace" | "add")}>
                      <option value="add">Add to my categories</option>
                      <option value="replace">Replace my categories</option>
                    </select>
                  </label>
                )}
                <button
                  className="btn-primary"
                  disabled={pending || !proposal.some((c) => c.include && c.name.trim())}
                  onClick={() => {
                    setError(null);
                    start(async () => {
                      const r = await applyProposal({ mode, categories: proposal.filter((c) => c.include && c.name.trim()).map(({ include: _i, sampleTitles: _s, ...rest }) => { void _i; void _s; return rest; }) });
                      if (r.error) return setError(r.error);
                      setProposal(null);
                      setDone(true);
                      router.refresh();
                    });
                  }}
                >
                  {pending ? <Loader2 size={15} className="animate-spin" /> : null} Apply
                </button>
                <button className="btn-ghost" disabled={pending} onClick={() => setProposal(null)}>Discard</button>
              </div>
            </div>
          )}
          {done && <p className="text-sm text-success">Categories applied. Open the calendar and choose &ldquo;Colour by: Type&rdquo;.</p>}
        </>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
