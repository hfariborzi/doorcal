import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/**
 * The DoorCal mark, drawn exactly as design/logo/doorcal-logo.svg: a door with three calendar rings on top
 * and a knob. Only the color changes (black in the file, `currentColor` here) so it shows on the dark theme.
 */
export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 5400 6573" width={(size * 5400) / 6573} height={size} fill="none" aria-hidden className={className}>
      <rect x="150" y="500" width="5100" height="5923" rx="350" stroke="currentColor" strokeWidth="300" />
      <rect x="3698" width="1000" height="1000" rx="200" fill="currentColor" />
      <rect x="3698" y="2852" width="1000" height="1000" rx="200" fill="currentColor" />
      <rect x="677" width="1000" height="1000" rx="200" fill="currentColor" />
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
