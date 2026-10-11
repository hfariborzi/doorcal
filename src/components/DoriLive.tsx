"use client";

/* eslint-disable @next/next/no-img-element */
import { useSyncExternalStore } from "react";

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
export function DoriLive({ size = 96, className = "" }: { size?: number; className?: string }) {
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(reducedQuery).matches, () => true);
  const hevc = useSyncExternalStore(noop, prefersHevc, () => false);
  const style = { width: size, height: size };
  if (reduced) return <img src="/dori/dori-idle-poster.webp" alt="Dori the puppy" width={size} height={size} draggable={false} className={`pointer-events-none shrink-0 select-none ${className}`} style={style} />;
  return (
    <video
      key={hevc ? "hevc" : "webm"}
      autoPlay
      loop
      muted
      playsInline
      disablePictureInPicture
      preload="auto"
      poster="/dori/dori-idle-poster.webp"
      width={size}
      height={size}
      aria-label="Dori the puppy"
      className={`pointer-events-none shrink-0 select-none ${className}`}
      style={style}
    >
      {hevc ? <source src="/dori/dori-idle.mp4" type='video/mp4; codecs="hvc1"' /> : <source src="/dori/dori-idle.webm" type="video/webm" />}
    </video>
  );
}
