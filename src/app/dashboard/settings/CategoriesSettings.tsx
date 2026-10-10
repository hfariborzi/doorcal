"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Category, LabelRule, Priority } from "@/db/schema";
import { CATEGORY_PALETTE, MAX_CATEGORIES, PRIORITIES, PRIORITY_LABEL } from "@/lib/labels/core";
import { deleteCategory, deleteRule, saveCategory, saveRule } from "../actions";

function PrioritySelect({ value, onChange, allowDefault, id }: { value: Priority | null; onChange: (p: Priority | null) => void; allowDefault?: boolean; id?: string }) {
  return (
    <select id={id} className="input w-36 py-1.5" value={value ?? ""} onChange={(e) => onChange(e.target.value ? (e.target.value as Priority) : null)}>
      {allowDefault && <option value="">Category default</option>}
      {PRIORITIES.map((p) => (
        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
      ))}
    </select>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_PALETTE.map((c) => (
        <button key={c} type="button" onClick={() => onChange(c)} aria-label={c} className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-canvas ${value === c ? "ring-2 ring-ink" : ""}`} style={{ background: c }} />
      ))}
    </div>
  );
}

export function CategoriesSettings({ categories, rules }: { categories: Category[]; rules: LabelRule[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", color: CATEGORY_PALETTE[(categories.length) % CATEGORY_PALETTE.length], defaultPriority: "normal" as Priority });
  const [ruleDraft, setRuleDraft] = useState<{ pattern: string; categoryId: number | null; priority: Priority | null }>({ pattern: "", categoryId: categories[0]?.id ?? null, priority: null });
  const run = (fn: () => Promise<{ error?: string }>) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  };

  return (
    <section className="card space-y-6 p-6">
      <div>
        <h2 className="font-semibold">Areas</h2>
        <p className="text-sm text-faint">
          The areas of your life: they colour your calendar by type and hold your projects and tasks. Each has a
          colour and a default priority; events you don&apos;t label fall under &ldquo;Other&rdquo;. Up to {MAX_CATEGORIES}.
        </p>
      </div>

      <ul className="divide-y divide-line border-y border-line">
        {categories.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
            <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: c.color }} />
            <input
              className="input w-48 py-1.5"
              defaultValue={c.name}
              aria-label="Category name"
              onBlur={(e) => e.target.value.trim() !== c.name && run(() => saveCategory({ id: c.id, name: e.target.value, color: c.color, defaultPriority: c.defaultPriority }))}
            />
            <input
              className="input min-w-40 flex-1 py-1.5 text-sm"
              defaultValue={c.description}
              placeholder="What belongs here (optional)"
              aria-label="Category description"
              onBlur={(e) => e.target.value.trim() !== c.description && run(() => saveCategory({ id: c.id, name: c.name, color: c.color, defaultPriority: c.defaultPriority, description: e.target.value }))}
            />
            <span className="text-xs text-faint">priority</span>
            <PrioritySelect value={c.defaultPriority} onChange={(p) => run(() => saveCategory({ id: c.id, name: c.name, color: c.color, defaultPriority: p ?? "normal" }))} />
            <div className="hidden sm:block"><ColorPicker value={c.color} onChange={(color) => run(() => saveCategory({ id: c.id, name: c.name, color, defaultPriority: c.defaultPriority }))} /></div>
            <button className="btn-ghost ml-auto px-2 py-1.5 text-danger hover:text-danger" disabled={pending} title="Delete category" onClick={() => confirm(`Delete "${c.name}"? Events labelled with it become "Other".`) && run(() => deleteCategory(c.id))}>
              <Trash2 size={15} />
            </button>
          </li>
        ))}
        {categories.length === 0 && <li className="py-3 text-sm text-faint">No categories yet.</li>}
      </ul>

      {categories.length < MAX_CATEGORIES && (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await saveCategory(draft);
              if (!r.error) setDraft({ name: "", color: CATEGORY_PALETTE[(categories.length + 1) % CATEGORY_PALETTE.length], defaultPriority: "normal" });
              return r;
            });
          }}
        >
          <div>
            <label className="label" htmlFor="cat-name">New area</label>
            <input id="cat-name" className="input w-48 py-1.5" required maxLength={30} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Office hours" />
          </div>
          <div>
            <label className="label" htmlFor="cat-pri">Default priority</label>
            <PrioritySelect id="cat-pri" value={draft.defaultPriority} onChange={(p) => setDraft({ ...draft, defaultPriority: p ?? "normal" })} />
          </div>
          <div>
            <span className="label">Colour</span>
            <ColorPicker value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
          </div>
          <button type="submit" className="btn-secondary py-1.5" disabled={pending}><Plus size={15} /> Add</button>
        </form>
      )}

      <div className="border-t border-line pt-5">
        <h3 className="font-semibold">Rules</h3>
        <p className="text-sm text-faint">
          &ldquo;If the title contains…&rdquo;. Rules run first; the first match wins. Labelling an event by hand with
          &ldquo;apply to every event with this title&rdquo; makes one of these.
        </p>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {rules.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
              <span className="text-faint">contains</span>
              <span className="rounded-md bg-well px-2 py-0.5 font-mono text-xs text-ink">{r.pattern}</span>
              <span className="text-faint">→</span>
              <select className="input w-44 py-1.5" value={r.categoryId ?? ""} onChange={(e) => run(() => saveRule({ id: r.id, pattern: r.pattern, categoryId: e.target.value ? Number(e.target.value) : null, priority: r.priority }))}>
                <option value="">Other</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <PrioritySelect value={r.priority} allowDefault onChange={(p) => run(() => saveRule({ id: r.id, pattern: r.pattern, categoryId: r.categoryId, priority: p }))} />
              <button className="btn-ghost ml-auto px-2 py-1.5 text-danger hover:text-danger" disabled={pending} title="Delete rule" onClick={() => run(() => deleteRule(r.id))}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
          {rules.length === 0 && <li className="py-3 text-sm text-faint">No rules yet.</li>}
        </ul>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const r = await saveRule(ruleDraft);
              if (!r.error) setRuleDraft({ ...ruleDraft, pattern: "" });
              return r;
            });
          }}
        >
          <div>
            <label className="label" htmlFor="rule-pattern">Title contains</label>
            <input id="rule-pattern" className="input w-56 py-1.5" required minLength={2} maxLength={120} value={ruleDraft.pattern} onChange={(e) => setRuleDraft({ ...ruleDraft, pattern: e.target.value })} placeholder="standup" />
          </div>
          <div>
            <label className="label" htmlFor="rule-cat">Category</label>
            <select id="rule-cat" className="input w-44 py-1.5" value={ruleDraft.categoryId ?? ""} onChange={(e) => setRuleDraft({ ...ruleDraft, categoryId: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Other</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="rule-pri">Priority</label>
            <PrioritySelect id="rule-pri" value={ruleDraft.priority} allowDefault onChange={(p) => setRuleDraft({ ...ruleDraft, priority: p })} />
          </div>
          <button type="submit" className="btn-secondary py-1.5" disabled={pending}><Plus size={15} /> Add rule</button>
        </form>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
