"use client";

import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/Logo";
import styles from "./hero3d.module.css";

type EventTone = "meeting" | "focus" | "booking" | "deadline";
type CalendarEvent = { title: string; meta: string; tone: EventTone; top: number; height: number };

const DAYS: { day: string; date: string; today?: boolean; events: CalendarEvent[] }[] = [
  {
    day: "MON",
    date: "12",
    events: [
      { title: "Team standup", meta: "9:00 · Meet", tone: "meeting", top: 16, height: 52 },
      { title: "Write Q4 report", meta: "10:30 · 2h", tone: "focus", top: 86, height: 96 },
      { title: "Intro call", meta: "2:00 · Booked", tone: "booking", top: 236, height: 62 },
    ],
  },
  {
    day: "TUE",
    date: "13",
    today: true,
    events: [
      { title: "Review contract", meta: "9:30 · 1h 30m", tone: "focus", top: 46, height: 78 },
      { title: "Lunch with Sam", meta: "12:00", tone: "meeting", top: 170, height: 50 },
      { title: "Design review", meta: "3:00 · Teams", tone: "meeting", top: 278, height: 66 },
    ],
  },
  {
    day: "WED",
    date: "14",
    events: [
      { title: "Interview · J. Park", meta: "10:00 · Booked", tone: "booking", top: 74, height: 56 },
      { title: "Q4 report · part 2", meta: "1:00 · 3h", tone: "focus", top: 218, height: 122 },
    ],
  },
  {
    day: "THU",
    date: "15",
    events: [
      { title: "Morning run", meta: "8:30 · 45m", tone: "focus", top: 18, height: 50 },
      { title: "1:1 with Lee", meta: "11:00", tone: "meeting", top: 126, height: 54 },
      { title: "Send invoices", meta: "2:00 · 1h", tone: "focus", top: 252, height: 70 },
    ],
  },
  {
    day: "FRI",
    date: "16",
    events: [
      { title: "Client call", meta: "9:00 · Meet", tone: "meeting", top: 42, height: 58 },
      { title: "Finish report", meta: "11:00 · 2h", tone: "focus", top: 126, height: 96 },
      { title: "Report due", meta: "5:00 pm", tone: "deadline", top: 326, height: 48 },
    ],
  },
];

/**
 * Product-led hero scene. The calendar remains almost front-facing and readable; depth comes from a few
 * raised utility cards and restrained pointer parallax instead of exaggerated 3D extrusion.
 */
export function Hero3D() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;

    const fit = () => el.style.setProperty("--scale", String(Math.min(1, el.clientWidth / 1120)));
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);

    let frame = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const animate = () => {
      currentX += (targetX - currentX) * 0.08;
      currentY += (targetY - currentY) * 0.08;
      el.style.setProperty("--pointer-x", currentX.toFixed(3));
      el.style.setProperty("--pointer-y", currentY.toFixed(3));
      frame = Math.abs(targetX - currentX) + Math.abs(targetY - currentY) > 0.002 ? requestAnimationFrame(animate) : 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = el.getBoundingClientRect();
      targetX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      targetY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      if (!frame) frame = requestAnimationFrame(animate);
    };

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) el.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      observer.disconnect();
      el.removeEventListener("pointermove", onPointerMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={stage} className={styles.stage} aria-hidden>
      <div className={styles.fit}>
        <div className={styles.ambient} />
        <div className={styles.scene}>
          <div className={styles.depthBack} />
          <div className={styles.depthMid} />
          <div className={styles.shell}>
            <div className={styles.chrome}>
              <div className={styles.traffic}><i /><i /><i /></div>
              <div className={styles.brand}><LogoMark size={12} style={{ color: "var(--accent)" }} /> midore</div>
              <div className={styles.sync}><i /> All calendars synced</div>
            </div>

            <div className={styles.app}>
              <aside className={styles.sidebar}>
                <p className={styles.sideLabel}>WORKSPACE</p>
                <div className={styles.sideItem} data-active><span>◫</span> Calendar</div>
                <div className={styles.sideItem}><span>✓</span> Tasks <b>7</b></div>
                <div className={styles.sideItem}><span>↗</span> Booking</div>
                <p className={styles.sideLabel}>CALENDARS</p>
                <div className={styles.calendarItem}><i data-color="purple" /> Work</div>
                <div className={styles.calendarItem}><i data-color="amber" /> Personal</div>
                <div className={styles.calendarItem}><i data-color="rose" /> Deadlines</div>
                <div className={styles.capacity}>
                  <span>Week capacity</span><b>82%</b>
                  <div><i /></div>
                  <small>4h 30m still open</small>
                </div>
              </aside>

              <div className={styles.calendar}>
                <div className={styles.toolbar}>
                  <div>
                    <span className={styles.toolbarLabel}>YOUR WEEK</span>
                    <strong>October 12–16</strong>
                  </div>
                  <div className={styles.toolbarActions}><span>Today</span><b>Week</b><span>Day</span></div>
                </div>

                <div className={styles.dayGrid}>
                  {DAYS.map(({ day, date, today, events }) => (
                    <div key={day} className={styles.day} data-today={today || undefined}>
                      <div className={styles.dayHeader}><span>{day}</span><b>{date}</b>{today && <small>TODAY</small>}</div>
                      <div className={styles.track}>
                        {events.map((event) => (
                          <div
                            key={`${event.title}-${event.top}`}
                            className={styles.event}
                            data-tone={event.tone}
                            style={{ top: event.top, height: event.height }}
                          >
                            <b>{event.title}</b><span>{event.meta}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles.nowLine}><i /><span>10:45</span></div>
              </div>
            </div>
          </div>

          <div className={styles.doriCard}>
            <div className={styles.doriHead}>
              <span className={styles.doriAvatar}>✦</span>
              <div><b>Dori</b><small>Calendar assistant</small></div>
              <i />
            </div>
            <p>“Report due Friday, review the contract, and run three times this week.”</p>
            <div className={styles.doriReply}>
              <span>✦</span>
              <p>I found room for all four tasks without moving a meeting.</p>
            </div>
            <div className={styles.cardActions}><b>Show the plan</b><span>Undo</span></div>
          </div>

          <div className={styles.bookingCard}>
            <span className={styles.cardEyebrow}>BOOKING PAGE</span>
            <b>Intro call</b>
            <small>30 min · Google Meet</small>
            <div className={styles.slots}><span>9:30</span><span data-selected>11:00</span><span>2:30</span></div>
            <div className={styles.bookButton}>Book 11:00</div>
          </div>

          <div className={styles.planToast}><i /> Plan updated <span>6 blocks placed</span></div>
        </div>
      </div>
    </div>
  );
}
