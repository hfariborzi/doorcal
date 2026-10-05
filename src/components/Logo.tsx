import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/**
 * The DoorCal mark (design/logo/doorcal-logo.svg): a door with calendar rings on top and a knob.
 * The outline uses a non-scaling stroke so it stays crisp at any size.
 */
export function LogoMark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 5400 6573"
      width={(size * 5400) / 6573}
      height={size}
      overflow="visible"
      aria-hidden
      className={className}
    >
      <rect
        x="25"
        y="375"
        width="5350"
        height="6173"
        rx="475"
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(1.5, size / 14)}
        vectorEffect="non-scaling-stroke"
      />
      {[962, 2330, 3698].map((x) => (
        <rect key={x} x={x} y="0" width="700" height="700" rx="200" fill="currentColor" />
      ))}
      <rect x="4426" y="2836" width="700" height="700" rx="200" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = "/", size = 28 }: { href?: string; size?: number }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-ink">
      <LogoMark size={size} className="text-accent-soft" />
      <span className="text-[17px]">{APP_NAME}</span>
    </Link>
  );
}
