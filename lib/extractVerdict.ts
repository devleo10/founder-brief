export type Verdict = "SHIP IT" | "PIVOT" | "KILL IT" | null;

export function verdictFromScore(overall: number | null | undefined): Verdict {
  if (typeof overall !== "number") return null;
  if (overall >= 7) return "SHIP IT";
  if (overall >= 4) return "PIVOT";
  return "KILL IT";
}

export function extractVerdict(text: string, overall?: number | null): Verdict {
  if (text) {
    const match = text.match(/<verdict>\s*(SHIP IT|PIVOT|KILL IT)\s*<\/verdict>/i);
    if (match) return match[1].toUpperCase() as Verdict;
  }

  // Prefer the structured score over keyword scanning — synthesis text often
  // mentions multiple verdict words ("this is not a SHIP IT...").
  const fromScore = verdictFromScore(overall);
  if (fromScore) return fromScore;

  if (!text) return null;
  // Last resort: look for a verdict-like statement, checking most destructive first.
  if (/\bKILL IT\b/.test(text)) return "KILL IT";
  if (/\bPIVOT\b/.test(text)) return "PIVOT";
  if (/\bSHIP IT\b/.test(text)) return "SHIP IT";
  return null;
}
