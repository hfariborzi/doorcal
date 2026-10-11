"use client";

/* eslint-disable @next/next/no-img-element */
import { createContext, useContext } from "react";
import type { DoriCharacter, DoriMood } from "@/db/schema";
import { DoriLive } from "./DoriLive";

export type { DoriMood, DoriCharacter };

/** Which character the signed-in user picked for Dori. Set once by the dashboard layout. */
const CharacterContext = createContext<DoriCharacter>("puppy");
export function DoriCharacterProvider({ value, children }: { value: DoriCharacter; children: React.ReactNode }) {
  return <CharacterContext.Provider value={value}>{children}</CharacterContext.Provider>;
}
export const useDoriCharacter = () => useContext(CharacterContext);

const MOOD_WORDS: Record<DoriMood, string> = {
  happy: "smiling",
  thinking: "head tilted, thinking",
  busy: "carrying a stack of cards",
  celebrating: "jumping for joy",
  concerned: "looking concerned",
  sleeping: "asleep",
};

/**
 * The assistant's mascot, as the user's chosen character. The puppy has a still for every mood on a shared
 * baseline; the kitten so far has only her idle loop, so her other moods show its first frame. "Concerned" is
 * worried for the user, never sad at them. `live` plays the happy mood's transparent idle video.
 */
export function Dori({ mood = "happy", size = 96, className = "", live = false, character }: { mood?: DoriMood; size?: number; className?: string; live?: boolean; character?: DoriCharacter }) {
  const chosen = useContext(CharacterContext);
  const who = character ?? chosen;
  if (live && mood === "happy") return <DoriLive size={size} className={className} character={who} />;
  const src = who === "kitten" ? "/dori/kitten-idle-poster.webp" : size > 128 ? `/dori/dori-${mood}-512.webp` : `/dori/dori-${mood}-256.webp`;
  return (
    <img
      src={src}
      alt={`Dori the ${who}, ${MOOD_WORDS[mood]}`}
      width={size}
      height={size}
      draggable={false}
      className={`pointer-events-none shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
