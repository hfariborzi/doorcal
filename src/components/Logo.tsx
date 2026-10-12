import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/** Width over height of the mark. */
const MARK_RATIO = 5312 / 7339;

/** The owner's mark (October 2026): a small block above a large one, with a notch cut into the large block's base. */
export const MARK_TOP = "M1888 600C1888 268.629 2156.63 0 2488 0H2824C3155.37 0 3424 268.629 3424 600V936C3424 1267.37 3155.37 1536 2824 1536H2488C2156.63 1536 1888 1267.37 1888 936V600Z";
export const MARK_BODY =
  "M0 3027C0 2474.72 447.715 2027 1000 2027H4312C4864.28 2027 5312 2474.72 5312 3027V6339C5312 6891.28 4864.28 7339 4312 7339H3424V7171C3424 6839.63 3155.37 6571 2824 6571H2488C2156.63 6571 1888 6839.63 1888 7171V7339H1000C447.715 7339 0 6891.28 0 6339V3027Z";
export const MARK_COLOR = "#E11D48";
export const MARK_VIEWBOX = "0 0 5312 7339";

/**
 * The Midore mark, always in vermilion. The notch at the base is a real cut-out, so the page behind shows through
 * on light and dark grounds alike. The favicon and app icons (src/app/icon.svg, favicon.ico, apple-icon.png) use
 * the same paths.
 */
function MarkSvg({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox={MARK_VIEWBOX} fill={MARK_COLOR} aria-hidden className={className} style={style}>
      <path d={MARK_TOP} />
      <path d={MARK_BODY} />
    </svg>
  );
}

/** The mark alone. `size` is its height in pixels; it is a little narrower than it is tall. */
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
      <MarkSvg className={markClassName} style={{ width: `${1.05 * MARK_RATIO}em`, height: "1.05em", flexShrink: 0 }} />
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
