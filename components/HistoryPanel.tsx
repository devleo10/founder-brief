import { useState } from "react";
import type { HistoryEntry } from "@/lib/types";
import { extractVerdict } from "@/lib/extractVerdict";

export default function HistoryPanel({
  entries,
  onSelect,
  onClear,
}: {
  entries: HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;

  return (
    <div className="history-section">
      <button className="history-toggle" onClick={() => setOpen(!open)}>
        <span>PAST VERDICTS ({entries.length})</span>
        <span className="history-chevron">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="history-list">
          {entries.map((e, i) => {
            const v = e.verdict || extractVerdict(e.synthesis.output, e.synthesis.scores?.overall) || "—";
            const cls = v === "SHIP IT" ? "ship" : v === "PIVOT" ? "pivot" : v === "KILL IT" ? "kill" : "";
            return (
              <button key={i} className="history-row" onClick={() => onSelect?.(e)}>
                <span className="history-row-title">{e.title || "Untitled idea"}</span>
                <span className={`history-row-verdict ${cls}`}>{v}</span>
                {e.overall !== null && <span className="history-row-score">{e.overall}/10</span>}
                <span className="history-row-date">{e.date}</span>
              </button>
            );
          })}
          {onClear && (
            <button type="button" className="history-clear" onClick={onClear}>
              Clear history
            </button>
          )}
        </div>
      )}
    </div>
  );
}
