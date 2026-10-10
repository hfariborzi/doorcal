/* eslint-disable @next/next/no-img-element */
import type { DoriMood } from "@/db/schema";

export type { DoriMood };

const ALT: Record<DoriMood, string> = {
  happy: "Dori the puppy, smiling",
  thinking: "Dori the puppy, head tilted, thinking",
  busy: "Dori the puppy, carrying a stack of cards",
  celebrating: "Dori the puppy, jumping for joy",
  concerned: "Dori the puppy, looking concerned",
  sleeping: "Dori the puppy, asleep",
};

/**
 * The assistant's mascot: a still image on a transparent background. All moods are 512px squares on a shared
 * baseline, so switching mood never shifts the layout. She is never sad at the user: "concerned" is worried
 * for them.
 */
export function Dori({ mood = "happy", size = 96, className = "" }: { mood?: DoriMood; size?: number; className?: string }) {
  const src = size > 128 ? `/dori/dori-${mood}-512.webp` : `/dori/dori-${mood}-256.webp`;
  return (
    <img
      src={src}
      alt={ALT[mood]}
      width={size}
      height={size}
      draggable={false}
      className={`pointer-events-none shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
