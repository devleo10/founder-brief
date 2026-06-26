import type { AgentScores, ScoreDimension } from "./types";
import { SCORE_DIMENSIONS } from "./types";

function clamp(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  // Strip markdown fences and trailing commas — common model slip-ups.
  const cleaned = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function toScores(parsed: Record<string, unknown>): AgentScores {
  const scores = emptyScores();
  let found = false;
  for (const dim of SCORE_DIMENSIONS) {
    const value = parsed[dim];
    if (typeof value === "number" && Number.isFinite(value)) {
      scores[dim] = clamp(value);
      found = true;
    } else if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
      scores[dim] = clamp(Number(value));
      found = true;
    }
  }
  return found ? scores : emptyScores();
}

export function extractScores(text: string): AgentScores {
  if (!text) return emptyScores();

  // Preferred path: the <scores> contract.
  const tagged = text.match(/<scores>([\s\S]*?)<\/scores>/i);
  if (tagged) {
    const parsed = tryParseJson(tagged[1]);
    if (parsed) return toScores(parsed);
  }

  // Fallback: find any JSON object in the text that mentions a known dimension.
  const candidates = text.match(/\{[^{}]*\}/g) || [];
  for (const candidate of candidates.reverse()) {
    if (!SCORE_DIMENSIONS.some((dim) => candidate.includes(`"${dim}"`))) continue;
    const parsed = tryParseJson(candidate);
    if (parsed) return toScores(parsed);
  }

  return emptyScores();
}

export function hasAnyScore(scores: AgentScores): boolean {
  return SCORE_DIMENSIONS.some((dim) => scores[dim] !== null);
}

/** Strips the machine-readable blocks so only the human critique remains. */
export function stripStructuredBlocks(text: string): string {
  return text
    .replace(/<scores>[\s\S]*?<\/scores>/gi, "")
    .replace(/<verdict>[\s\S]*?<\/verdict>/gi, "")
    .trim();
}

/** Per-dimension average across agent scores; used when synthesis scores are unparseable. */
export function averageScores(all: AgentScores[]): AgentScores {
  const result = emptyScores();
  for (const dim of SCORE_DIMENSIONS) {
    const values = all.map((s) => s[dim]).filter((v): v is number => typeof v === "number");
    if (values.length) {
      result[dim] = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }
  }
  return result;
}

export function emptyScores(): AgentScores {
  return { market: null, technical: null, launch: null, ux: null, retention: null, overall: null };
}
