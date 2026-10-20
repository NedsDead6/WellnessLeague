import type { CategoryKey, Group } from "./scoring";

// Each pillar has one neon color (GROUP_COLORS) used for points in the daily
// log. The chart splits a pillar into shades of the same hue so the stacked
// columns stay readable: greens physical, purples mental, golds spiritual, reds penalties.
export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  exercise: "#2bff88",
  steps: "#19cf75",
  meals: "#8affc0",
  sleep: "#12a352",
  water: "#c2ffe0",
  meditation: "#b58cff",
  work: "#8f63f0",
  social: "#d4b8ff",
  reading: "#6f45d1",
  journal: "#e6d6ff",
  worship: "#ffd23d",
  service: "#e0a800",
  screen: "#ff4d6d",
  drinks: "#ff7a90",
  weed: "#d92a4b",
  cigarettes: "#ffa3b3",
};

export const BONUS_COLOR = "#e6eeff";

export const GROUP_COLORS: Record<Group, string> = {
  physical: "#2bff88",
  mental: "#b58cff",
  spiritual: "#ffd23d",
  penalty: "#ff4d6d",
};

/** A translucent version of a #rrggbb color, for pill and chip backgrounds. */
export const tint = (hex: string, alpha = 0.16) =>
  `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0")}`;
