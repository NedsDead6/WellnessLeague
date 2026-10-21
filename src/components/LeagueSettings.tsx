"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { addDays } from "@/lib/dates";
import {
  CHALLENGE_METRICS,
  challengeTitle,
  metricInfo,
  weekOf,
  type Challenge,
  type ChallengeMetric,
} from "@/lib/league";
import { normalizeRules, type ScoringRules } from "@/lib/scoring";
import { supabase } from "@/lib/supabase";
import type { League, SaveStatus } from "@/lib/types";
import { periodLabel } from "@/lib/dates";
import { NumberField } from "./NumberField";
import { ScoringEditor } from "./ScoringEditor";

interface Props {
  league: League;
  today: string;
  userId: string;
  challenges: Challenge[];
  onBack: () => void;
  /** Called after the scoring rules are saved so the league list refreshes. */
  onScoringSaved: () => void | Promise<void>;
  onChallengesChanged: () => void | Promise<void>;
}

/** The owner's screen: this league's point values and its weekly team goals. */
export function LeagueSettings({ league, today, userId, challenges, onBack, onScoringSaved, onChallengesChanged }: Props) {
  const [rules, setRules] = useState<ScoringRules>(() => normalizeRules(league.scoring));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(rules);

  const persist = async () => {
    timer.current = null;
    if (!supabase) return;
    const { error: failed } = await supabase.from("leagues").update({ scoring: latest.current }).eq("id", league.id);
    if (failed) {
      setStatus("error");
      setError(failed.message);
    } else {
      setError(null);
      setStatus("saved");
      await onScoringSaved();
    }
  };

  const change = (next: ScoringRules) => {
    latest.current = next;
    setRules(next);
    setStatus("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), 700);
  };

  // Save a pending change if the owner leaves the screen right away.
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void persist();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const reset = () => change(normalizeRules({}));

  return (
    <>
      <ScoringEditor
        rules={rules}
        onChange={change}
        onReset={reset}
        onBack={onBack}
        backLabel={`Back to ${league.name}`}
        status={status}
        error={error}
        intro={
          <>
            These point values apply to everyone in {league.name}: standings, matchups, recaps and goals. Changing them
            re-scores every past day. Your own Personal stats aren&apos;t affected.
          </>
        }
      />
      <GoalsManager league={league} today={today} userId={userId} challenges={challenges} onChanged={onChallengesChanged} />
    </>
  );
}

function GoalsManager({
  league,
  today,
  userId,
  challenges,
  onChanged,
}: {
  league: League;
  today: string;
  userId: string;
  challenges: Challenge[];
  onChanged: () => void | Promise<void>;
}) {
  const [metric, setMetric] = useState<ChallengeMetric>("steps");
  const [target, setTarget] = useState<number>(CHALLENGE_METRICS[0].suggested);
  const [which, setWhich] = useState<"this" | "next">("this");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const thisWeek = weekOf(today);
  const upcoming = [...challenges].filter((c) => c.week_start >= addDays(thisWeek, -7)).sort((a, b) => (a.week_start < b.week_start ? 1 : -1));

  const add = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase || target <= 0) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from("league_challenges").insert({
      league_id: league.id,
      metric,
      target,
      week_start: which === "this" ? thisWeek : addDays(thisWeek, 7),
      created_by: userId,
    });
    if (error) setMessage(error.message);
    else await onChanged();
    setBusy(false);
  };

  const remove = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("league_challenges").delete().eq("id", id);
    if (error) setMessage(error.message);
    else await onChanged();
  };

  return (
    <section aria-label="Team goals">
      <div className="group-head">
        <span className="name">
          <span className="dot" style={{ background: "#e6eeff" }} />
          Team goals
        </span>
      </div>
      {upcoming.map((c) => (
        <div className="row" key={c.id}>
          <div className="row-top">
            <span className="row-label">{challengeTitle(c)}</span>
            <button className="text-button danger" type="button" onClick={() => void remove(c.id)}>
              Delete
            </button>
          </div>
          <span className="row-sub">Week of {periodLabel(c.week_start, "week")}</span>
        </div>
      ))}
      <form className="row" onSubmit={add}>
        <span className="row-label">Add a goal</span>
        <div className="rule-grid">
          <div className="rule-field">
            <span>Measure</span>
            <select
              className="select"
              value={metric}
              onChange={(e) => {
                const next = e.target.value as ChallengeMetric;
                setMetric(next);
                setTarget(metricInfo(next).suggested);
              }}
            >
              {CHALLENGE_METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="rule-field">
            <span>League total ({metricInfo(metric).unit})</span>
            <NumberField className="fill" label="Goal total" value={target} max={10000000} decimals={false} unit="" min={1} onCommit={setTarget} />
          </div>
          <div className="rule-field">
            <span>Week</span>
            <select className="select" value={which} onChange={(e) => setWhich(e.target.value as "this" | "next")}>
              <option value="this">This week</option>
              <option value="next">Next week</option>
            </select>
          </div>
        </div>
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Adding..." : "Add goal"}
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </section>
  );
}
