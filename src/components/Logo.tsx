import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/**
 * The Midore mark (interim, drawn in code): three rounded blocks at the pitches of the notes mi, do and re
 * (high, low, middle). They read as notes on a staff and as blocks on a calendar. `currentColor` lets the mark
 * follow the theme. The favicon and app icons (src/app/icon.svg, favicon.ico, apple-icon.png) use the same shapes.
 */
function MarkSvg({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden className={className} style={style}>
      <rect x="2" y="4" width="30" height="30" rx="8" />
      <rect x="35" y="66" width="30" height="30" rx="8" />
      <rect x="68" y="35" width="30" height="30" rx="8" />
    </svg>
  );
}

export function LogoMark({ size = 24, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return <MarkSvg className={className} style={{ width: size, height: size, ...style }} />;
}

/** The full logo: the mark followed by the name, set in the site font. `height` is a CSS length such as "22px" or "0.95em". */
export function FullLogo({
  height,
  className = "",
  markClassName = "text-accent-soft",
  inline = false,
}: {
  height: string;
  className?: string;
  markClassName?: string;
  inline?: boolean; // sit on the surrounding text's baseline
}) {
  return (
    <span
      role="img"
      aria-label={APP_NAME}
      className={`inline-flex items-center font-semibold tracking-[-0.03em] ${className}`}
      style={{ fontSize: height, lineHeight: 1, gap: "0.3em", verticalAlign: inline ? "-0.12em" : "middle" }}
    >
      <MarkSvg className={markClassName} style={{ width: "1.05em", height: "1.05em", flexShrink: 0 }} />
      <span aria-hidden>{APP_NAME.toLowerCase()}</span>
    </span>
  );
}

export function Logo({ href = "/", height = "22px" }: { href?: string; height?: string }) {
  return (
    <Link href={href} className="inline-flex items-center text-ink" aria-label={`${APP_NAME} home`}>
      <FullLogo height={height} />
    </Link>
  );
}
