"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import { DoriLive } from "@/components/DoriLive";
import styles from "./planner.module.css";

/*
 * The landing page's signature object: a magnetic week planner. Meetings are printed on the board and never move.
 * Everything else is a magnet: drag one to another free half-hour, and it snaps into place; drop it on a meeting
 * and it springs back. Tray magnets are placed by "Midore" itself, into the first gap that fits, which is how the
 * real planner works. All data here is example data.
 */

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FIRST_HOUR = 9;
const ROWS = 22; // 9 am to 8 pm in half hours

type Kind = "work" | "life" | "people";
type Magnet = { id: string; title: string; kind: Kind; col: number; row: number; len: number; suggested?: boolean };
type Meeting = { title: string; col: number; row: number; len: number; booked?: boolean };

const MEETINGS: Meeting[] = [
  { title: "Standup", col: 0, row: 0, len: 1 },
  { title: "Design review", col: 0, row: 8, len: 2 },
  { title: "Client call", col: 1, row: 2, len: 2 },
  { title: "Standup", col: 2, row: 0, len: 1 },
  { title: "1:1 with Lee", col: 2, row: 12, len: 2 },
  { title: "Interview", col: 3, row: 4, len: 2 },
  { title: "Standup", col: 4, row: 0, len: 1 },
  { title: "Intro call · Ana", col: 4, row: 10, len: 2, booked: true },
];

const START: Magnet[] = [
  { id: "q4", title: "Draft Q4 report", kind: "work", col: 0, row: 2, len: 4 },
  { id: "gym", title: "Gym", kind: "life", col: 0, row: 18, len: 2 },
  { id: "contract", title: "Review contract", kind: "work", col: 1, row: 10, len: 3 },
  { id: "mum", title: "Call mum", kind: "people", col: 1, row: 17, len: 1 },
  { id: "q4b", title: "Q4 report, part 2", kind: "work", col: 2, row: 3, len: 4 },
  { id: "run", title: "Run", kind: "life", col: 2, row: 16, len: 2 },
  { id: "invoices", title: "Send invoices", kind: "work", col: 3, row: 0, len: 3 },
  { id: "maya", title: "Dinner with Maya", kind: "people", col: 3, row: 18, len: 3 },
  { id: "finish", title: "Finish report", kind: "work", col: 4, row: 2, len: 4 },
  { id: "groceries", title: "Groceries", kind: "life", col: 5, row: 2, len: 2 },
  { id: "tidy", title: "Tidy up", kind: "life", col: 5, row: 5, len: 2 },
  { id: "friends", title: "Friends over", kind: "people", col: 5, row: 16, len: 4 },
  { id: "walk", title: "Long walk?", kind: "life", col: 6, row: 4, len: 2, suggested: true },
];

const TRAY: Omit<Magnet, "col" | "row">[] = [
  { id: "book", title: "Read a book", kind: "life", len: 2 },
  { id: "laundry", title: "Laundry", kind: "life", len: 2 },
  { id: "film", title: "Movie night", kind: "people", len: 4 },
];

function timeLabel(row: number) {
  const minutes = FIRST_HOUR * 60 + row * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}${m ? `:${m}` : ""} ${h < 12 ? "am" : "pm"}`;
}

function overlaps(a: { col: number; row: number; len: number }, b: { col: number; row: number; len: number }) {
  return a.col === b.col && a.row < b.row + b.len && b.row < a.row + a.len;
}

export function PlannerBoard() {
  const [magnets, setMagnets] = useState<Magnet[]>(START);
  const [tray, setTray] = useState(TRAY);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "no"; key: number } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const week = useRef<HTMLDivElement>(null);
  const els = useRef(new Map<string, HTMLButtonElement>());
  const drag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const flip = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const say = useCallback((text: string, tone: "ok" | "no") => setNote({ text, tone, key: Date.now() }), []);

  /** Whether a magnet could sit at this place: inside the board, off every meeting and every other magnet. */
  const fits = useCallback(
    (m: { id: string; col: number; row: number; len: number }, list: Magnet[]) => {
      if (m.col < 0 || m.col > 6 || m.row < 0 || m.row + m.len > ROWS) return "out";
      if (MEETINGS.some((x) => overlaps(m, x))) return "meeting";
      if (list.some((x) => x.id !== m.id && overlaps(m, x))) return "magnet";
      return "ok";
    },
    [],
  );

  // Phones see the week from the end, so the weekend (friends, a free Sunday) is in view first.
  useEffect(() => {
    const el = week.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = el.scrollWidth - el.clientWidth;
  }, []);

  // After a drop, play the last bit of the move as a settle: the magnet starts where it was let go and springs in.
  useEffect(() => {
    const f = flip.current;
    if (!f) return;
    flip.current = null;
    const el = els.current.get(f.id);
    if (!el) return;
    el.style.transition = "none";
    el.style.transform = `translate(${f.dx}px, ${f.dy}px)`;
    requestAnimationFrame(() => {
      el.style.transition = "";
      el.style.transform = "";
    });
  }, [magnets]);

  function cell() {
    const r = grid.current!.getBoundingClientRect();
    return { left: r.left, top: r.top, w: r.width / 7, h: r.height / ROWS };
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>, id: string) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.dataset.lifted = "";
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    e.currentTarget.style.transition = "none";
    e.currentTarget.style.transform = `translate(${dx}px, ${dy}px) rotate(-2deg)`;
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>, m: Magnet) {
    const d = drag.current;
    drag.current = null;
    const el = e.currentTarget;
    delete el.dataset.lifted;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved) {
      el.style.transform = "";
      if (m.suggested) {
        setMagnets((list) => list.map((x) => (x.id === m.id ? { ...x, suggested: false, title: x.title.replace(/\?$/, "") } : x)));
        say(`Pinned: ${m.title.replace(/\?$/, "")}, Sunday ${timeLabel(m.row)}`, "ok");
      }
      return;
    }
    const c = cell();
    const target = { ...m, col: m.col + Math.round(dx / c.w), row: m.row + Math.round(dy / c.h) };
    const verdict = fits(target, magnets);
    if (verdict !== "ok") {
      el.style.transition = "";
      el.style.transform = "";
      el.dataset.refused = "";
      setTimeout(() => delete el.dataset.refused, 420);
      say(verdict === "meeting" ? "That time has a meeting. Meetings stay put." : verdict === "magnet" ? "Something is already there." : "Keep it on the board.", "no");
      return;
    }
    flip.current = { id: m.id, dx: dx - (target.col - m.col) * c.w, dy: dy - (target.row - m.row) * c.h };
    setMagnets((list) => list.map((x) => (x.id === m.id ? target : x)));
    say(`${m.title}: ${DAYS[target.col]} ${timeLabel(target.row)}`, "ok");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, m: Magnet) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!step) return;
    e.preventDefault();
    const target = { ...m, col: m.col + step[0], row: m.row + step[1] };
    const verdict = fits(target, magnets);
    if (verdict !== "ok") return say(verdict === "meeting" ? "That time has a meeting. Meetings stay put." : "That spot is taken.", "no");
    setMagnets((list) => list.map((x) => (x.id === m.id ? target : x)));
    say(`${m.title}: ${DAYS[target.col]} ${timeLabel(target.row)}`, "ok");
  }

  /** What the planner does: put a magnet in the first gap that fits, earliest day and hour first. */
  function place(t: (typeof TRAY)[number]) {
    for (let col = 0; col < 7; col++) {
      for (let row = 16; row + t.len <= ROWS; row++) {
        const candidate = { ...t, col, row };
        if (fits(candidate, magnets) === "ok") {
          setMagnets((list) => [...list, { ...candidate, id: t.id }]);
          setTray((list) => list.filter((x) => x.id !== t.id));
          say(`Midore found room: ${t.title}, ${DAYS[col]} ${timeLabel(row)}`, "ok");
          return;
        }
      }
    }
    say("No evening left this week. Something has to give.", "no");
  }

  return (
    <div className={styles.planner}>
      <div ref={week} className={styles.week} role="group" aria-label="Example week. Drag a magnet, or focus it and use the arrow keys, to move it.">
        <div className={styles.days} aria-hidden>
          {DAYS.map((d, i) => (
            <span key={d} data-today={i === 1 || undefined} data-weekend={i > 4 || undefined}>
              {d}
            </span>
          ))}
        </div>
        <div className={styles.rail} aria-hidden>
          {Array.from({ length: ROWS / 2 }, (_, h) => (
            <span key={h} style={{ top: `calc(${h * 2} * var(--row))` }}>
              {((FIRST_HOUR + h + 11) % 12) + 1}
            </span>
          ))}
        </div>
        <div ref={grid} className={styles.grid}>
          {MEETINGS.map((m, i) => (
            <div
              key={i}
              className={styles.meeting}
              data-booked={m.booked || undefined}
              style={{ "--c": m.col, "--r": m.row, "--l": m.len, "--i": i } as React.CSSProperties}
              aria-label={`${m.title}, ${DAYS[m.col]} ${timeLabel(m.row)}, fixed`}
            >
              {m.booked && <Link2 size={11} strokeWidth={2.25} aria-hidden />}
              {m.title}
            </div>
          ))}
          <p className={styles.sunday} aria-hidden>
            Nothing planned.
            <br />
            Chill?
          </p>
          {magnets.map((m, i) => (
            <button
              key={m.id}
              ref={(el) => {
                if (el) els.current.set(m.id, el);
                else els.current.delete(m.id);
              }}
              type="button"
              className={styles.magnet}
              data-kind={m.kind}
              data-suggested={m.suggested || undefined}
              style={{ "--c": m.col, "--r": m.row, "--l": m.len, "--i": i + MEETINGS.length } as React.CSSProperties}
              onPointerDown={(e) => onPointerDown(e, m.id)}
              onPointerMove={onPointerMove}
              onPointerUp={(e) => onPointerUp(e, m)}
              onPointerCancel={(e) => onPointerUp(e, m)}
              onKeyDown={(e) => onKeyDown(e, m)}
              aria-label={`${m.title}, ${DAYS[m.col]} ${timeLabel(m.row)}${m.suggested ? ", suggested by Dori. Click to pin" : ""}`}
            >
              <span>{m.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tray}>
        <div className={styles.trayMagnets}>
          {tray.map((t) => (
            <button key={t.id} type="button" className={styles.loose} data-kind={t.kind} onClick={() => place(t)} title="Let Midore find it a slot">
              {t.title}
            </button>
          ))}
          {tray.length === 0 && <span className={styles.trayEmpty}>All placed.</span>}
        </div>
        <p key={note?.key} className={styles.note} data-tone={note?.tone} role="status" aria-live="polite">
          {note?.text ?? "Drag a magnet, or tap one on the tray."}
        </p>
        <div className={styles.dori}>
          <DoriLive size={84} />
        </div>
      </div>
    </div>
  );
}
