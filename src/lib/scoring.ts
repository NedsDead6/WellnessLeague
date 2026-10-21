// Scoring rules for Own Your Day. Pure functions only, so the same code can
// score entries in the browser now and on the server later.
// Every rule below comes from the plan's scoring table. Change numbers here,
// and the whole app follows.

export type Pillar = "physical" | "mental" | "spiritual";
export type Group = Pillar | "penalty";

/** One day of entries, in natural units. */
export interface DayEntry {
  exerciseMin: number;
  /** What the exercise was, in the person's own words. Visible to league mates. */
  exerciseNote: string;
  steps: number;
  /** Three meals, each graded 0 (skipped or junk), 1 (mixed), 2 (healthy). */
  meals: [number, number, number];
  sleepHours: number;
  meditationMin: number;
  workHours: number;
  socialHours: number;
  /** Phone calls to family or friends. */
  calls: number;
  readingMin: number;
  journalMin: number;
  worshipMin: number;
  serviceHours: number;
  screenHours: number; // non-work only
  drinks: number;
  weed: number;
  cigarettes: number;
  masturbation: number;
}

export const EMPTY_DAY: DayEntry = {
  exerciseMin: 0,
  exerciseNote: "",
  steps: 0,
  meals: [0, 0, 0],
  sleepHours: 0,
  meditationMin: 0,
  workHours: 0,
  socialHours: 0,
  calls: 0,
  readingMin: 0,
  journalMin: 0,
  worshipMin: 0,
  serviceHours: 0,
  screenHours: 0,
  drinks: 0,
  weed: 0,
  cigarettes: 0,
  masturbation: 0,
};

export type CategoryKey =
  | "exercise"
  | "steps"
  | "meals"
  | "sleep"
  | "meditation"
  | "work"
  | "social"
  | "calls"
  | "reading"
  | "journal"
  | "worship"
  | "service"
  | "screen"
  | "drinks"
  | "weed"
  | "cigarettes"
  | "masturbation";

export const CATEGORIES: { key: CategoryKey; label: string; group: Group }[] = [
  { key: "exercise", label: "Exercise", group: "physical" },
  { key: "steps", label: "Steps", group: "physical" },
  { key: "meals", label: "Healthy meals", group: "physical" },
  { key: "sleep", label: "Sleep", group: "physical" },
  { key: "work", label: "Work", group: "mental" },
  { key: "social", label: "Social time", group: "mental" },
  { key: "calls", label: "Calls to family or friends", group: "mental" },
  { key: "reading", label: "Reading", group: "mental" },
  { key: "journal", label: "Journaling or gratitude", group: "mental" },
  { key: "meditation", label: "Meditation", group: "spiritual" },
  { key: "worship", label: "Worship and prayer", group: "spiritual" },
  { key: "service", label: "Service or volunteering", group: "spiritual" },
  { key: "screen", label: "Screen time (non-work)", group: "penalty" },
  { key: "drinks", label: "Alcoholic drinks", group: "penalty" },
  { key: "weed", label: "Weed", group: "penalty" },
  { key: "cigarettes", label: "Cigarettes", group: "penalty" },
  { key: "masturbation", label: "Masturbation", group: "penalty" },
];

export type CategoryPoints = Record<CategoryKey, number>;

export const emptyCategoryPoints = (): CategoryPoints =>
  Object.fromEntries(CATEGORIES.map((c) => [c.key, 0])) as CategoryPoints;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type RuleKey =
  | "exercise"
  | "steps"
  | "meditation"
  | "work"
  | "social"
  | "calls"
  | "reading"
  | "journal"
  | "worship"
  | "service"
  | "screen"
  | "drinks"
  | "weed"
  | "cigarettes"
  | "masturbation";

/**
 * `points` for every `per` units, up to `max` points (null means no cap).
 * Penalties have negative points. A `smooth` rule pays for partial units too
 * (steps); the others only pay for each full unit.
 */
export interface Rule {
  points: number;
  per: number;
  max: number | null;
  smooth?: boolean;
}

export interface ScoringRules {
  rules: Record<RuleKey, Rule>;
  /** Points for a mixed (1) and a healthy (2) meal. A junk meal (0) earns nothing. */
  meals: { mixed: number; healthy: number };
  /** Points per hour up to 8 hours, plus a bonus at 7 and at 8 or more hours. */
  sleep: { perHour: number; bonus7: number; bonus8: number };
  balanceBonus: number;
  /** Paid on every 7th consecutive logged day. */
  streakBonus: number;
}

export const PENALTY_KEYS: RuleKey[] = ["screen", "drinks", "weed", "cigarettes", "masturbation"];

/** The standard scoring. Leagues always use this; people can customize their own copy. */
export const DEFAULT_RULES: ScoringRules = {
  rules: {
    exercise: { points: 1, per: 15, max: 12 },
    steps: { points: 1, per: 4000, max: 20, smooth: true },
    meditation: { points: 1, per: 15, max: 8 },
    work: { points: 1, per: 1, max: 14 },
    social: { points: 1, per: 1, max: 6 },
    calls: { points: 1, per: 1, max: 3 },
    reading: { points: 1, per: 30, max: 4 },
    journal: { points: 1, per: 15, max: 3 },
    worship: { points: 1, per: 15, max: 8 },
    service: { points: 1, per: 1, max: 4 },
    screen: { points: -1, per: 1, max: null },
    drinks: { points: -0.5, per: 1, max: null },
    weed: { points: -5, per: 1, max: null },
    cigarettes: { points: -0.5, per: 1, max: null },
    masturbation: { points: -1, per: 1, max: 3 },
  },
  meals: { mixed: 1, healthy: 2 },
  sleep: { perHour: 1, bonus7: 1, bonus8: 2 },
  balanceBonus: 2,
  streakBonus: 2,
};

const finite = (value: unknown, fallback: number, min = 0): number =>
  typeof value === "number" && Number.isFinite(value) && value >= min ? value : fallback;

/** Fills in and cleans up stored rules so a bad or old row can never break scoring. */
export function normalizeRules(raw: unknown): ScoringRules {
  const src = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof ScoringRules, any>>;
  const rules = {} as Record<RuleKey, Rule>;
  for (const key of Object.keys(DEFAULT_RULES.rules) as RuleKey[]) {
    const base = DEFAULT_RULES.rules[key];
    const given = src.rules?.[key] ?? {};
    const penalty = PENALTY_KEYS.includes(key);
    const rawPoints = typeof given.points === "number" ? Math.abs(given.points) : Number.NaN;
    const points = Number.isFinite(rawPoints) ? rawPoints : Math.abs(base.points);
    const max = penalty
      ? "max" in given
        ? typeof given.max === "number" && given.max >= 0
          ? given.max
          : null
        : base.max
      : finite(given.max, base.max as number);
    rules[key] = {
      points: penalty ? -points : points,
      per: finite(given.per, base.per, 0.01),
      max,
      ...(base.smooth ? { smooth: true } : {}),
    };
  }
  return {
    rules,
    meals: {
      mixed: finite(src.meals?.mixed, DEFAULT_RULES.meals.mixed),
      healthy: finite(src.meals?.healthy, DEFAULT_RULES.meals.healthy),
    },
    sleep: {
      perHour: finite(src.sleep?.perHour, DEFAULT_RULES.sleep.perHour),
      bonus7: finite(src.sleep?.bonus7, DEFAULT_RULES.sleep.bonus7),
      bonus8: finite(src.sleep?.bonus8, DEFAULT_RULES.sleep.bonus8),
    },
    balanceBonus: finite(src.balanceBonus, DEFAULT_RULES.balanceBonus),
    streakBonus: finite(src.streakBonus, DEFAULT_RULES.streakBonus),
  };
}

export const isDefaultRules = (rules: ScoringRules) => JSON.stringify(normalizeRules(rules)) === JSON.stringify(DEFAULT_RULES);

function ruleScore(value: number, rule: Rule): number {
  const v = Math.max(0, value);
  const units = rule.smooth ? v / rule.per : Math.floor(v / rule.per);
  let points = units * rule.points;
  if (rule.max !== null) points = rule.points >= 0 ? Math.min(rule.max, points) : Math.max(-rule.max, points);
  return round3(points);
}

/** Points for a meal graded 0 (junk), 1 (mixed) or 2 (healthy). */
export function mealPoints(grade: number, rules: ScoringRules = DEFAULT_RULES): number {
  return grade >= 2 ? rules.meals.healthy : grade >= 1 ? rules.meals.mixed : 0;
}

export function sleepPoints(hours: number, rules: ScoringRules = DEFAULT_RULES): number {
  const h = Math.max(0, hours);
  const bonus = h >= 8 ? rules.sleep.bonus8 : h >= 7 ? rules.sleep.bonus7 : 0;
  return round3(Math.min(h, 8) * rules.sleep.perHour + bonus);
}

/** The most points each pillar can earn in a day, for progress bars. */
export function pillarMax(rules: ScoringRules): Record<Pillar, number> {
  const r = rules.rules;
  const cap = (key: RuleKey) => r[key].max ?? 0;
  return {
    physical:
      cap("exercise") +
      cap("steps") +
      3 * rules.meals.healthy +
      8 * rules.sleep.perHour +
      Math.max(rules.sleep.bonus7, rules.sleep.bonus8),
    mental: cap("work") + cap("social") + cap("calls") + cap("reading") + cap("journal"),
    spiritual: cap("meditation") + cap("worship") + cap("service"),
  };
}

/** Points each category earned (or lost) for one day, before any bonuses. */
export function categoryPoints(e: DayEntry, rules: ScoringRules = DEFAULT_RULES): CategoryPoints {
  const r = rules.rules;
  return {
    exercise: ruleScore(e.exerciseMin, r.exercise),
    steps: ruleScore(e.steps, r.steps),
    meals: round3(e.meals.reduce((sum, grade) => sum + mealPoints(grade, rules), 0)),
    sleep: sleepPoints(e.sleepHours, rules),
    meditation: ruleScore(e.meditationMin, r.meditation),
    work: ruleScore(e.workHours, r.work),
    social: ruleScore(e.socialHours, r.social),
    calls: ruleScore(e.calls, r.calls),
    reading: ruleScore(e.readingMin, r.reading),
    journal: ruleScore(e.journalMin, r.journal),
    worship: ruleScore(e.worshipMin, r.worship),
    service: ruleScore(e.serviceHours, r.service),
    screen: ruleScore(e.screenHours, r.screen),
    drinks: ruleScore(e.drinks, r.drinks),
    weed: ruleScore(e.weed, r.weed),
    cigarettes: ruleScore(e.cigarettes, r.cigarettes),
    masturbation: ruleScore(e.masturbation, r.masturbation),
  };
}

export interface DayScore {
  physical: number;
  mental: number;
  spiritual: number;
  penalties: number;
  balanceBonus: number;
  streakBonus: number;
  total: number;
  categories: CategoryPoints;
}

/**
 * @param streakDays Consecutive days logged, counting this one. The streak
 *   bonus lands on every 7th consecutive day.
 */
export function scoreDay(e: DayEntry, streakDays: number, rules: ScoringRules = DEFAULT_RULES): DayScore {
  const categories = categoryPoints(e, rules);
  const sumOf = (group: Group) =>
    CATEGORIES.filter((c) => c.group === group).reduce((sum, c) => sum + categories[c.key], 0);

  const physical = round3(sumOf("physical"));
  const mental = round3(sumOf("mental"));
  const spiritual = round3(sumOf("spiritual"));
  const penalties = round3(sumOf("penalty"));

  const balanceBonus = physical > 0 && mental > 0 && spiritual > 0 ? rules.balanceBonus : 0;
  const streakBonus = streakDays > 0 && streakDays % 7 === 0 ? rules.streakBonus : 0;
  const total = round3(physical + mental + spiritual + penalties + balanceBonus + streakBonus);

  return { physical, mental, spiritual, penalties, balanceBonus, streakBonus, total, categories };
}
