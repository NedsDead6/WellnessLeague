import type { CategoryKey, Group } from "./scoring";

// Slightly neon colors for every scoring category, grouped by hue family:
// greens and blues for physical, purples and pinks for mental, golds for
// spiritual, reds for penalties. Used by the daily log and the charts.
export const CATEGORY_COLORS: Record<CategoryKey, string> = {
  exercise: "#2bff88",
  steps: "#00e0c6",
  meals: "#b8ff3d",
  sleep: "#3dd5ff",
  water: "#4d8dff",
  meditation: "#c47cff",
  work: "#ff5ccb",
  social: "#7c83ff",
  reading: "#ff8fb8",
  journal: "#dcb0ff",
  worship: "#ffd23d",
  service: "#ff9f3d",
  screen: "#ff4d6d",
  drinks: "#ff7a59",
  weed: "#e8344e",
  cigarettes: "#ff9a9a",
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
