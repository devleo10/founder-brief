export const SCORE_DIMENSIONS = ["market", "technical", "launch", "ux", "retention", "overall"] as const;
export type ScoreDimension = (typeof SCORE_DIMENSIONS)[number];

export type AgentScores = {
  [K in ScoreDimension]: number | null;
};

export type AgentResult = {
  agent: string;
  output: string;
  scores: AgentScores;
  error?: boolean;
};

export type SynthesisResult = {
  output: string;
  scores: AgentScores;
};

export type ValidateResponse = {
  agents: AgentResult[];
  synthesis: SynthesisResult;
};

export type IdeaInput = {
  title: string;
  description: string;
  context?: string;
  targetUser?: string;
  problem?: string;
  solution?: string;
  differentiator?: string;
  businessModel?: string;
  pricing?: string;
  distribution?: string;
  competitors?: string;
  constraints?: string;
  successMetric?: string;
  timeline?: string;
};

export type HistoryEntry = {
  title: string;
  description: string;
  date: string;
  verdict: string;
  overall: number | null;
  agents: AgentResult[];
  synthesis: SynthesisResult;
};
