/* eslint-disable @next/next/no-img-element */

/** Dori's moods. She is never sad or disappointed at the user: "concerned" is worried for them. */
export type DoriMood = "happy" | "thinking" | "busy" | "celebrating" | "concerned" | "sleeping";

const ALT: Record<DoriMood, string> = {
  happy: "Dori the puppy, smiling",
  thinking: "Dori the puppy, head tilted, thinking",
  busy: "Dori the puppy, carrying a stack of cards",
  celebrating: "Dori the puppy, jumping for joy",
  concerned: "Dori the puppy, looking concerned",
  sleeping: "Dori the puppy, asleep",
};

/**
 * The assistant's mascot. Images are 512px squares with a shared baseline, so every mood lines up.
 * Moves gently (a slow bob, a hop when celebrating) unless the user prefers reduced motion.
 */
export function Dori({ mood = "happy", size = 96, animate = true, className = "" }: { mood?: DoriMood; size?: number; animate?: boolean; className?: string }) {
  const src = size > 128 ? `/dori/dori-${mood}-512.webp` : `/dori/dori-${mood}-256.webp`;
  const motion = !animate || mood === "sleeping" ? "" : mood === "celebrating" ? "dori-hop" : "dori-bob";
  return (
    <img
      src={src}
      alt={ALT[mood]}
      width={size}
      height={size}
      draggable={false}
      className={`pointer-events-none select-none drop-shadow-[0_6px_10px_rgb(76_29_149/0.18)] ${motion} ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
