import Link from "next/link";
import { APP_NAME } from "@/lib/config";

/**
 * The DoorCal mark, drawn exactly as design/logo/doorcal-logo.svg: a "D" that doubles as a door, with three
 * calendar rings on top and a knob. Only the color changes (black in the file, `currentColor` here) so it
 * shows on the dark theme.
 */
export function LogoMark({ size = 24, className = "", style }: { size?: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 3699 4173"
      width={(size * 3699) / 4173}
      height={size}
      fill="none"
      aria-hidden
      className={className}
      style={style}
    >
      <path d="M2324.72 2025C2324.72 1969.77 2369.49 1925 2424.72 1925H2713.72C2768.95 1925 2813.72 1969.77 2813.72 2025V2314C2813.72 2369.23 2768.95 2414 2713.72 2414H2424.72C2369.49 2414 2324.72 2369.23 2324.72 2314V2025Z" fill="currentColor" />
      <rect x="1260.22" width="489" height="489" rx="100" fill="currentColor" />
      <rect x="2324.22" width="489" height="489" rx="100" fill="currentColor" />
      <rect x="196.219" width="489" height="489" rx="100" fill="currentColor" />
      <path d="M14.6484 569.133C379.232 582.154 670.573 588.664 888.672 588.664C1295.57 575.643 1545.41 569.133 1638.18 569.133C1789.55 569.133 1931.97 575.643 2065.43 588.664C2198.89 601.685 2336.43 626.099 2478.03 661.906C2621.26 696.086 2750.65 741.659 2866.21 798.625C2981.77 853.964 3092.45 928.02 3198.24 1020.79C3304.04 1113.57 3392.74 1220.99 3464.36 1343.06C3535.97 1465.13 3592.94 1612.43 3635.25 1784.95C3677.57 1955.85 3698.73 2145.47 3698.73 2353.8C3685.71 2554 3650.72 2737.92 3593.75 2905.56C3538.41 3073.2 3466.8 3218.06 3378.91 3340.13C3292.64 3462.2 3190.1 3571.25 3071.29 3667.28C2952.47 3763.31 2827.96 3841.43 2697.75 3901.65C2569.17 3961.87 2429.2 4011.52 2277.83 4050.58C2128.09 4089.64 1981.61 4117.31 1838.38 4133.59C1696.78 4149.86 1550.29 4158 1398.93 4158C788.574 4158 325.521 4162.88 9.76562 4172.65C3.25521 4153.12 0 4136.84 0 4123.82C0 4112.43 3.25521 4090.45 9.76562 4057.9C58.5938 4053.02 97.6562 4048.95 126.953 4045.7C156.25 4042.44 196.126 4036.74 246.582 4028.61C298.665 4020.47 340.169 4011.52 371.094 4001.75C403.646 3990.36 437.012 3976.52 471.191 3960.25C505.371 3943.97 530.599 3924.44 546.875 3901.65C564.779 3878.87 573.73 3852.82 573.73 3823.53C593.262 3314.09 603.027 2800.58 603.027 2283C603.027 1755.66 594.889 1300.74 578.613 918.254C576.986 875.936 558.268 840.129 522.461 810.832C486.654 779.908 434.57 756.307 366.211 740.031C299.479 723.755 242.513 712.362 195.312 705.852C149.74 697.714 89.5182 690.389 14.6484 683.879C8.13802 654.582 4.88281 634.237 4.88281 622.844C4.88281 613.078 8.13802 595.174 14.6484 569.133ZM1149.9 918.254C1128.74 1471.64 1118.16 1986.78 1118.16 2463.66C1118.16 2727.34 1127.12 3231.89 1145.02 3977.34C1215.01 3980.59 1315.1 3982.22 1445.31 3982.22C1708.98 3982.22 1943.36 3942.34 2148.44 3862.59C2353.52 3781.21 2521.97 3668.09 2653.81 3523.23C2785.64 3378.38 2884.93 3207.48 2951.66 3010.54C3020.02 2811.97 3054.2 2593.06 3054.2 2353.8C3054.2 2230.1 3044.43 2108.85 3024.9 1990.03C3005.37 1871.22 2974.45 1749.96 2932.13 1626.26C2889.81 1502.56 2831.22 1388.63 2756.35 1284.46C2681.48 1180.3 2591.96 1087.52 2487.79 1006.14C2385.25 923.137 2258.3 858.846 2106.93 813.273C1957.19 766.073 1791.18 742.473 1608.89 742.473C1441.24 742.473 1288.25 753.052 1149.9 774.211V918.254Z" fill="currentColor" />
    </svg>
  );
}

/*
 * The mark is a "D", so the wordmark is the mark followed by the rest of the name: [D]oorCal.
 * Sizes are in em so it scales with the surrounding text. The D's body (below the rings) is 86% of the
 * mark's height and should match the font's cap height (0.71em for Geist), so the mark is 0.71 / 0.86 =
 * 0.826em tall. As an inline-block its bottom sits on the text baseline, like the letters after it.
 */
const MARK_HEIGHT_EM = 0.826;
const MARK_WIDTH_EM = (MARK_HEIGHT_EM * 3699) / 4173;

export function Wordmark({ className = "", markClassName = "text-accent-soft" }: { className?: string; markClassName?: string }) {
  // Self-hosted instances can rename the app; only fold the mark into the name when it starts with a D.
  const rest = /^d/i.test(APP_NAME) ? APP_NAME.slice(1) : null;
  return (
    <span className={`inline-block font-bold tracking-tight whitespace-nowrap ${className}`}>
      <span className="sr-only">{APP_NAME}</span>
      <span aria-hidden>
        <LogoMark
          className={markClassName}
          style={{
            display: "inline-block",
            height: `${MARK_HEIGHT_EM}em`,
            width: `${MARK_WIDTH_EM}em`,
            marginRight: rest === null ? "0.3em" : "0.035em",
            verticalAlign: "baseline",
          }}
        />
        {rest ?? APP_NAME}
      </span>
    </span>
  );
}

export function Logo({ href = "/", className = "text-[22px]" }: { href?: string; className?: string }) {
  return (
    <Link href={href} className="inline-block text-ink" aria-label={`${APP_NAME} home`}>
      <Wordmark className={className} />
    </Link>
  );
}
