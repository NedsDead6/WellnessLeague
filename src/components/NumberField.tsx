"use client";

import { useState } from "react";

interface Props {
  value: number;
  max: number;
  /** Allow a decimal part (hours); otherwise whole numbers only. */
  decimals: boolean;
  unit: string;
  label: string;
  onCommit: (value: number) => void;
}

/** A number the person can type, shown with thousands separators when not being edited. */
export function NumberField({ value, max, decimals, unit, label, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toLocaleString("en-US", { maximumFractionDigits: 2 });

  const change = (raw: string) => {
    const typed = raw.replace(/\s/g, "");
    const cleaned = typed.replace(/,/g, "");
    if (!(decimals ? /^\d*\.?\d{0,2}$/ : /^\d*$/).test(cleaned)) return;
    setDraft(typed);
    const parsed = cleaned === "" || cleaned === "." ? 0 : Math.min(max, parseFloat(cleaned));
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <label className="num">
      <input
        type="text"
        inputMode={decimals ? "decimal" : "numeric"}
        autoComplete="off"
        aria-label={unit ? `${label} (${unit})` : label}
        value={shown}
        onFocus={(e) => {
          setDraft(String(value === 0 ? "" : value));
          e.currentTarget.select();
        }}
        onChange={(e) => change(e.target.value)}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
      />
      {unit && <span className="unit">{unit}</span>}
    </label>
  );
}
