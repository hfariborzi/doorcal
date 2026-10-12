/**
 * The Midore palette: ten shades built around the brand's magnet colours (vermilion, amber, sage), spaced around
 * the colour wheel at matched depth so they read as one set on the board. Categories, calendars and meeting types
 * all draw from it. Colours that come from elsewhere (Google calendar colours, categories saved before this
 * palette) are shown as their nearest Midore shade. Pure; unit tested.
 */
export const MIDORE_PALETTE = [
  "#e11d48", // vermilion
  "#e2603f", // coral
  "#f5a524", // amber
  "#b8861f", // ochre
  "#7d9550", // moss
  "#557563", // sage
  "#2f7a78", // teal
  "#4a6a8c", // slate
  "#6b5bb5", // iris
  "#9a4a78", // plum
] as const;

/** For "other" and anything with no colour of its own. */
export const GRAPHITE = "#6b6b74";

function hsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

const PALETTE_HSL = MIDORE_PALETTE.map((c) => [c, hsl(c)!] as const);

/** The Midore shade closest to any colour: by hue first, with lightness breaking ties between neighbours. */
export function toPalette(color: string | null | undefined): string {
  if (!color) return GRAPHITE;
  if ((MIDORE_PALETTE as readonly string[]).includes(color.toLowerCase())) return color.toLowerCase();
  const c = hsl(color);
  if (!c || c[1] < 0.18) return GRAPHITE;
  let best: string = MIDORE_PALETTE[0];
  let bestD = Infinity;
  for (const [hex, [h, , l]] of PALETTE_HSL) {
    const dh = Math.min(Math.abs(h - c[0]), 360 - Math.abs(h - c[0])) / 180;
    const d = dh * 3 + Math.abs(l - c[2]);
    if (d < bestD) {
      bestD = d;
      best = hex;
    }
  }
  return best;
}
