"use client";

import { useEffect, useRef } from "react";
import styles from "./hero3d.module.css";

type Kind = "meeting" | "plan" | "booked" | "deadline";
type Tile = { day: number; from: number; to: number; kind: Kind; title: string; sub: string };

const DAYS = ["Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16"];
const FIRST_HOUR = 8;
const HOURS = 10; // 8 am to 6 pm
const ROW = 44; // px per hour on the board
const COL = 150;
const RAIL = 52;
const HEAD = 58;

// Meetings land first, then planned work drops into the gaps, then the deadline.
const TILES: Tile[] = [
  { day: 0, from: 9, to: 9.75, kind: "meeting", title: "Team standup", sub: "9:00" },
  { day: 0, from: 10, to: 12, kind: "plan", title: "Draft Q4 report", sub: "Planned · 2h" },
  { day: 0, from: 14, to: 15, kind: "booked", title: "Intro call · Ana", sub: "Booked · Meet" },
  { day: 1, from: 9, to: 10.5, kind: "plan", title: "Review contract", sub: "Planned · 1h 30m" },
  { day: 1, from: 12, to: 13, kind: "meeting", title: "Lunch with Sam", sub: "12:00" },
  { day: 1, from: 15, to: 16.5, kind: "meeting", title: "Design review", sub: "3:00 · Teams" },
  { day: 2, from: 10, to: 11, kind: "booked", title: "Interview · J. Park", sub: "Booked · Meet" },
  { day: 2, from: 13, to: 16, kind: "plan", title: "Q4 report, part 2", sub: "Planned · 3h" },
  { day: 3, from: 8.5, to: 9.5, kind: "plan", title: "Run", sub: "Reminder · 3× a week" },
  { day: 3, from: 11, to: 12, kind: "meeting", title: "1:1 with Lee", sub: "11:00" },
  { day: 3, from: 14, to: 15.5, kind: "plan", title: "Send invoices", sub: "Planned · 1h 30m" },
  { day: 4, from: 9, to: 10, kind: "meeting", title: "Client call", sub: "9:00 · Meet" },
  { day: 4, from: 11, to: 13, kind: "plan", title: "Finish report", sub: "Planned · 2h" },
  { day: 4, from: 16, to: 17, kind: "deadline", title: "Report due", sub: "Friday · 5 pm" },
];

const ORDER: Record<Kind, number> = { meeting: 0, booked: 1, plan: 2, deadline: 3 };
const LIFT: Record<Kind, number> = { meeting: 6, booked: 10, plan: 16, deadline: 24 };
const EDGE_LAYERS = 6;
const LOGO_LAYERS = 18;

/**
 * The landing page's 3D scene: a week on Midore, tilted in space. Meetings sit on the board, planned work drops
 * into the gaps, and Dori's note and the logo float above. Pure CSS 3D; the pointer tilts the scene.
 */
export function Hero3D() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const fit = () => el.style.setProperty("--s", String(Math.min(1, el.clientWidth / 1080)));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);

    let raf = 0;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      el.style.setProperty("--px", cx.toFixed(4));
      el.style.setProperty("--py", cy.toFixed(4));
      raf = Math.abs(tx - cx) + Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(tick) : 0;
    };
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still) window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const sorted = [...TILES].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.day - b.day || a.from - b.from);

  return (
    <div ref={stage} className={styles.stage} aria-hidden>
      <div className={styles.fit}>
        <div className={styles.scene}>
          <div className={styles.world}>
            <div className={styles.floor} />

            <div className={styles.board}>
              <div className={styles.head}>
                <span className={styles.week}>Oct 12 – 16</span>
                <span className={styles.legend}>
                  <i data-kind="meeting" /> Meetings <i data-kind="plan" /> Planned <i data-kind="booked" /> Booked
                </span>
              </div>
              {DAYS.map((d, i) => (
                <div key={d} className={styles.dayHead} style={{ left: RAIL + i * COL, width: COL }} data-today={i === 1 || undefined}>
                  {d}
                </div>
              ))}
              {Array.from({ length: HOURS + 1 }, (_, h) => (
                <div key={h} className={styles.hour} style={{ top: HEAD + h * ROW }}>
                  <span>{((FIRST_HOUR + h - 1) % 12) + 1}</span>
                </div>
              ))}
              {DAYS.map((d, i) => (
                <div key={d} className={styles.col} style={{ left: RAIL + i * COL, top: HEAD, height: HOURS * ROW }} />
              ))}
              <div className={styles.now} style={{ left: RAIL + COL, top: HEAD + (13.4 - FIRST_HOUR) * ROW, width: COL }} />

              {sorted.map((t, i) => (
                <div
                  key={`${t.day}-${t.from}`}
                  className={styles.tile}
                  data-kind={t.kind}
                  style={
                    {
                      left: RAIL + t.day * COL + 6,
                      top: HEAD + (t.from - FIRST_HOUR) * ROW + 2,
                      width: COL - 12,
                      height: (t.to - t.from) * ROW - 4,
                      "--z": `${LIFT[t.kind]}px`,
                      "--d": `${0.25 + i * 0.09 + (t.kind === "plan" ? 0.35 : 0) + (t.kind === "deadline" ? 0.6 : 0)}s`,
                    } as React.CSSProperties
                  }
                >
                  <div className={styles.shadow} />
                  {Array.from({ length: EDGE_LAYERS }, (_, k) => (
                    <div key={k} className={styles.edge} style={{ transform: `translateZ(calc(var(--z) * ${k / EDGE_LAYERS}))` }} />
                  ))}
                  <div className={styles.face}>
                    <b>{t.title}</b>
                    {(t.to - t.from) * ROW > 30 && <span>{t.sub}</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.doriShadow} />
            <div className={styles.dori}>
              <div className={styles.doriHead}>
                <span className={styles.doriDot} />
                <b>Dori</b>
                <span>just now</span>
              </div>
              <p className={styles.you}>&ldquo;Q4 report due Friday, review the contract, send invoices, and I want to run three times a week.&rdquo;</p>
              <p className={styles.reply}>Added 4 tasks and a reminder. The report fits in three blocks before Friday, around all your meetings.</p>
              <div className={styles.actions}>
                <span>Looks good</span>
                <span>Undo</span>
              </div>
            </div>

            <div className={styles.toast}>
              <span className={styles.toastDot} /> Plan updated · 6 blocks placed
            </div>

            <div className={styles.logo}>
              <div className={styles.logoSpin}>
                {Array.from({ length: LOGO_LAYERS }, (_, k) => (
                  <div
                    key={k}
                    className={k === LOGO_LAYERS - 1 ? styles.logoFace : styles.logoLayer}
                    style={{ transform: `translateZ(${(k - LOGO_LAYERS / 2) * 1.6}px)` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
