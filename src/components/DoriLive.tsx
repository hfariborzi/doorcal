"use client";

/* eslint-disable @next/next/no-img-element */
import { useSyncExternalStore } from "react";
import type { DoriCharacter } from "@/db/schema";

const FILES: Record<DoriCharacter, { webm: string; mp4: string; poster: string }> = {
  puppy: { webm: "/dori/dori-idle.webm", mp4: "/dori/dori-idle.mp4", poster: "/dori/dori-idle-poster.webp" },
  kitten: { webm: "/dori/kitten-idle.webm", mp4: "/dori/kitten-idle.mp4", poster: "/dori/kitten-idle-poster.webp" },
};

const noop = () => () => {};
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(reducedQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/**
 * Apple's WebKit (Safari, and every browser on iPhone and iPad) plays transparent video only as HEVC with
 * alpha; Chrome, Edge and Firefox play transparent VP9 WebM but not HEVC alpha.
 */
function prefersHevc() {
  const ua = navigator.userAgent;
  return /AppleWebKit/.test(ua) && !/Chrome|Chromium|Edg\/|OPR\//.test(ua);
}

/**
 * Dori, alive: a short transparent loop of her idling (blinking, tilting her head). Renders the still poster
 * on the server, for reduced motion, and until the video starts.
 */
export function DoriLive({ size = 96, className = "", character = "puppy" }: { size?: number; className?: string; character?: DoriCharacter }) {
  const f = FILES[character];
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => true);
  const hevc = useSyncExternalStore(noop, prefersHevc, () => false);
  const style = { width: size, height: size };
  if (reduced) return <img src={f.poster} alt={`Dori the ${character}`} width={size} height={size} draggable={false} className={`pointer-events-none shrink-0 select-none ${className}`} style={style} />;
  return (
    <video
      key={`${character}-${hevc ? "hevc" : "webm"}`}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      preload="auto"
      poster={f.poster}
      width={size}
      height={size}
      aria-label={`Dori the ${character}`}
      className={`pointer-events-none shrink-0 select-none ${className}`}
      style={style}
    >
      {hevc ? <source src={f.mp4} type='video/mp4; codecs="hvc1"' /> : <source src={f.webm} type="video/webm" />}
    </video>
  );
}
