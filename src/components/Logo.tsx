import { useId } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/**
 * The DoorCal mark, drawn exactly as design/logo/doorcal-logo.svg: a door with three calendar rings on top
 * and a knob. Only the color changes (black in the file, `currentColor` here) so it shows on the dark theme.
 * The outline is an inside stroke (a centred stroke clipped by a mask), so each copy needs its own mask id.
 */
export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  const mask = `doorcal-logo-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 5400 5967" width={(size * 5400) / 5967} height={size} fill="none" aria-hidden className={className}>
      <mask id={mask} fill="white">
        <rect y="443.648" width="5400" height="5523.35" rx="500" />
      </mask>
      <rect y="443.648" width="5400" height="5523.35" rx="500" stroke="currentColor" strokeWidth="1600" mask={`url(#${mask})`} />
      <rect x="3430" width="1000" height="887.57" rx="200" fill="currentColor" />
      <rect x="3430" y="2705" width="1000" height="1000" rx="200" fill="currentColor" />
      <rect x="930" width="1000" height="1000" rx="200" fill="currentColor" />
      <rect x="2200" width="1000" height="1000" rx="200" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", size = 28 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <LogoMark size={size} className="text-accent-soft" />
      <span className="text-lg">{APP_NAME}</span>
    </Link>
  );
}
