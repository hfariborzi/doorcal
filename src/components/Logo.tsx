import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** Width over height of the mark. */
const MARK_RATIO = 2927 / 1844;

/**
 * The Midore mark: a rounded block with "do" cut out of it. The cut-outs are holes, so whatever sits behind the
 * mark shows through. `currentColor` lets it follow the theme (ink on light pages, white on dark). The favicon and
 * app icons (src/app/icon.svg, favicon.ico, apple-icon.png) use the same path.
 */
function MarkSvg({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 2927 1844" fill="currentColor" aria-hidden className={className} style={style}>
      <path
        fillRule="evenodd"
        d="M1932 0 L2427 0 A500 500 0 0 1 2927 500 L2927 1344 A500 500 0 0 1 2427 1844 L500 1844 A500 500 0 0 1 0 1344 L0 500 A500 500 0 0 1 500 0 L1422 0 L1422 464 A100 100 0 0 1 1322 564 L1172 564 A335 335 0 0 0 837 899 L837 1262 A335 335 0 0 0 1507 1262 L1507 425 A425 425 0 0 1 1932 0 Z M1778 910 A340 340 0 1 0 2458 910 A340 340 0 1 0 1778 910 Z"
      />
    </svg>
  );
}

/** The mark alone. `size` is its height in pixels; it is about 1.6 times as wide. */
export function LogoMark({ size = 24, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return <MarkSvg className={className} style={{ width: size * MARK_RATIO, height: size, ...style }} />;
}

/** The full logo: the mark followed by the name, set in the site font. `height` is a CSS length such as "22px" or "0.95em". */
export function FullLogo({
  height,
  className = "",
  markClassName = "",
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
      <MarkSvg className={markClassName} style={{ width: `${0.85 * MARK_RATIO}em`, height: "0.85em", flexShrink: 0 }} />
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
