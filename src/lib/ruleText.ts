import type { RuleKey, Rule } from "./scoring";

const WORDS: Record<RuleKey, [string, string]> = {
  exercise: ["min", "min"],
  steps: ["step", "steps"],
  meditation: ["min", "min"],
  work: ["hour", "hours"],
  social: ["hour", "hours"],
  reading: ["min", "min"],
  journal: ["min", "min"],
  worship: ["min", "min"],
  service: ["hour", "hours"],
  screen: ["hour", "hours"],
  drinks: ["drink", "drinks"],
  weed: ["time", "times"],
  cigarettes: ["cigarette", "cigarettes"],
};

export const fmtNum = (n: number) => Number(n.toFixed(3)).toLocaleString("en-US", { maximumFractionDigits: 3 });

/** A rule in words, like "+1 per 15 min (max 12)". */
export function ruleText(key: RuleKey, rule: Rule): string {
  const [one, many] = WORDS[key];
  const per = rule.per === 1 ? one : `${fmtNum(rule.per)} ${many}`;
  const max = rule.max === null ? "" : ` (max ${fmtNum(rule.max)})`;
  return `${rule.points < 0 ? "-" : "+"}${fmtNum(Math.abs(rule.points))} per ${per}${max}`;
}
