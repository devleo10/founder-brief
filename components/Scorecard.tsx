"use client";

import { useState, useEffect } from "react";
import type { AgentScores } from "@/lib/types";

const LABELS: Record<string, string> = {
  market: "Market",
  technical: "Technical",
  launch: "Launch",
  ux: "UX",
  retention: "Retention",
  overall: "Overall",
};

// Color is the judgment, not decoration: red = weak, amber = risky, green = strong.
function tone(val: number): string {
  if (val >= 7) return "good";
  if (val >= 4) return "warn";
  return "bad";
}

export default function Scorecard({ scores }: { scores: AgentScores | null }) {
  const [animate, setAnimate] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimate(true), 100); return () => clearTimeout(t); }, []);

  if (!scores) return null;
  const data = Object.entries(scores).filter(([k, v]) => v !== null && k !== "overall");
  if (data.length === 0) return null;

  return (
    <div className="scorecard">
      {data.map(([key, val], i) => (
        <div key={key} className={`score-tile ${tone(val as number)}`} style={{ animationDelay: `${i * 60}ms` }}>
          <div className="score-tile-label">{LABELS[key] || key}</div>
          <div className="score-tile-value">{val}<span className="score-tile-den">/10</span></div>
          <div className="score-tile-track">
            <div className="score-tile-fill" style={{ width: animate ? `${(val as number) * 10}%` : "0%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}
