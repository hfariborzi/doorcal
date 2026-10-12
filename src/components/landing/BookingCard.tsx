"use client";

import { useState } from "react";
import { Video } from "lucide-react";
import styles from "./landing.module.css";

const SLOTS = ["9:30 am", "11:00 am", "1:30 pm", "3:00 pm", "4:30 pm", "5:15 pm"];

/** An example booking page card. Picking a time works; nothing is sent. */
export function BookingCard() {
  const [picked, setPicked] = useState<string | null>("11:00 am");
  return (
    <div className={`${styles.card} w-full max-w-sm p-6 sm:p-7`}>
      <p className="text-sm text-faint">midore.app/ana</p>
      <h3 className={`${styles.display} mt-1 text-2xl text-ink`}>Intro call</h3>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
        <Video size={15} strokeWidth={1.75} aria-hidden /> 30 min · Google Meet
      </p>
      <p className="mt-6 text-sm font-medium text-ink">Tuesday, October 13</p>
      <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Example times">
        {SLOTS.map((s) => (
          <button key={s} type="button" aria-pressed={picked === s} onClick={() => setPicked(s)} className={`${styles.slot} py-2 text-sm tabular-nums text-ink`}>
            {s}
          </button>
        ))}
      </div>
      <div className="mt-5 rounded-md bg-ink px-4 py-2.5 text-center text-sm font-semibold text-canvas" aria-hidden>
        {picked ? `Book ${picked}` : "Pick a time"}
      </div>
    </div>
  );
}
