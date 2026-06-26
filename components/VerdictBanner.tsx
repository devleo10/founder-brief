import type { Verdict } from "@/lib/extractVerdict";

const MEANING: Record<string, string> = {
  "SHIP IT": "Strong enough to test. Watch the risk named in the readout.",
  "PIVOT": "The pain is real, but this angle needs to change.",
  "KILL IT": "Do not build this version. Keep only the salvageable insight.",
};

export default function VerdictBanner({
  verdict,
  overall,
  onCopy,
  copied,
}: {
  verdict: Verdict;
  overall: number | null;
  onCopy: () => void;
  copied?: boolean;
}) {
  if (!verdict) return null;
  const cls = verdict === "SHIP IT" ? "ship" : verdict === "PIVOT" ? "pivot" : "kill";

  return (
    <div className={`verdict-block ${cls}`}>
      <div className="verdict-left">
        <div className="verdict-suptitle">Final judgment</div>
        <div className="verdict-stamp">{verdict}</div>
        <div className="verdict-meaning">{MEANING[verdict]}</div>
      </div>
      <div className="verdict-right">
        {overall !== null && (
          <div className="verdict-score">
            <span className="verdict-score-num">{overall}</span>
            <span className="verdict-score-den">/10</span>
          </div>
        )}
        <button className="verdict-copy" onClick={onCopy}>
          {copied ? "Copied" : "Copy verdict"}
        </button>
      </div>
    </div>
  );
}
