import type { HistoryEntry } from "./types";

const STORAGE_KEY = "idea-validator-history";
const MAX_ENTRIES = 20;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): HistoryEntry[] {
  const trimmed = entries.slice(0, MAX_ENTRIES);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {}
  }
  return trimmed;
}

/** Prepends an entry and drops duplicates with the same title + description. */
export function prependHistory(entry: HistoryEntry, existing: HistoryEntry[]): HistoryEntry[] {
  const key = `${entry.title.trim().toLowerCase()}|${entry.description.trim().toLowerCase()}`;
  const filtered = existing.filter(
    (e) => `${e.title.trim().toLowerCase()}|${e.description.trim().toLowerCase()}` !== key
  );
  return saveHistory([entry, ...filtered]);
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
