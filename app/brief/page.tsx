"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Search,
  DollarSign,
  BarChart3,
  Target,
  Megaphone,
  Compass,
  Rocket,
  Mic,
  Square,
  ArrowRight,
  ChevronLeft,
  X,
  Globe,
  Users,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { agentOrder, agentMetaMap } from "@/lib/agentMeta";
import { extractVerdict } from "@/lib/extractVerdict";
import { stripStructuredBlocks } from "@/lib/extractScores";
import { loadHistory, prependHistory, clearHistory } from "@/lib/historyStorage";
import type { AgentResult, SynthesisResult, HistoryEntry, IdeaInput } from "@/lib/types";
import type { Competitor, Positioning, LaunchStrategy } from "@/lib/research/types";
import AgentCard from "@/components/AgentCard";
import VerdictBanner from "@/components/VerdictBanner";
import HistoryPanel from "@/components/HistoryPanel";
import { ReportErrorBoundary } from "@/components/ReportErrorBoundary";
const Scorecard = dynamic(() => import("@/components/Scorecard"), { ssr: false });
import "../globals.css";
import "./brief.css";

type Phase = "form" | "results";
type InputMode = "quick" | "detailed";

// --- Research agent config (for loading chips) ---

const RESEARCH_AGENTS: Record<string, { label: string; icon: React.ReactNode }> = {
  competitors: { label: "Competitors", icon: <Search size={14} /> },
  pricing: { label: "Pricing", icon: <DollarSign size={14} /> },
  funding: { label: "Market Data", icon: <BarChart3 size={14} /> },
  gaps: { label: "Pain Points", icon: <Target size={14} /> },
  distribution: { label: "Distribution", icon: <Megaphone size={14} /> },
  positioning: { label: "Positioning", icon: <Compass size={14} /> },
  launch: { label: "Launch Plan", icon: <Rocket size={14} /> },
};

type ResearchAgentStatus = {
  agent: string;
  status: "pending" | "searching" | "analyzing" | "planning" | "done" | "error";
};

// --- Voice hook ---

function useQuickVoice(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState("");
  const recognitionRef = useRef<any>(null);
  const baseRef = useRef("");
  const finalsRef = useRef("");

  const supported =
    typeof window !== "undefined" &&
    (!!((window as any).SpeechRecognition) || !!(window as any).webkitSpeechRecognition);

  const start = (currentValue = "") => {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US";
    baseRef.current = currentValue.trim();
    finalsRef.current = "";
    setError("");
    setInterimText("");
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          finalsRef.current = `${finalsRef.current} ${transcript}`.trim();
        } else {
          interim += transcript;
        }
      }
      interim = interim.trim();
      setInterimText(interim);
      onText([baseRef.current, finalsRef.current, interim].filter(Boolean).join(" "));
    };
    recognition.onerror = (event: any) => {
      if (event.error === "aborted") return;
      setError(event.error === "no-speech" ? "Didn't catch anything. Try again." : "Voice input failed. Try again or type it.");
      setListening(false);
    };
    recognition.onend = () => { setListening(false); setInterimText(""); };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const stop = () => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    setInterimText("");
  };

  return { listening, interimText, error, supported, start, stop };
}

// --- Form field definitions ---

type FieldDef = {
  key: keyof typeof initialState;
  label: string;
  placeholder: string;
  textarea?: boolean;
};

const CONTEXT_GROUPS: { id: string; label: string; hint: string; fields: FieldDef[] }[] = [
  {
    id: "user",
    label: "Who it's for",
    hint: "Sharper user = sharper criticism",
    fields: [
      { key: "targetUser", label: "Target user", placeholder: "Solo freelance designers using Gmail + Google Calendar" },
      { key: "problem", label: "Problem", placeholder: "The painful job-to-be-done", textarea: true },
      { key: "successMetric", label: "Success metric", placeholder: "What proves this is working?" },
    ],
  },
  {
    id: "business",
    label: "Solution & business",
    hint: "The VC can't judge what you haven't priced",
    fields: [
      { key: "solution", label: "Solution", placeholder: "How your product solves the problem", textarea: true },
      { key: "differentiator", label: "Differentiator", placeholder: "What makes this non-obvious?" },
      { key: "businessModel", label: "Business model", placeholder: "SaaS, usage-based, marketplace..." },
      { key: "pricing", label: "Pricing", placeholder: "$20/mo, $99/mo, or per-seat" },
    ],
  },
  {
    id: "gtm",
    label: "Market & constraints",
    hint: "The Devil's Advocate needs to know what you're up against",
    fields: [
      { key: "distribution", label: "Distribution", placeholder: "How will you get the first 100 users?" },
      { key: "competitors", label: "Competitors", placeholder: "Direct and indirect alternatives" },
      { key: "constraints", label: "Constraints", placeholder: "Time, budget, compliance, data access" },
      { key: "timeline", label: "Timeline", placeholder: "MVP in 4 weeks, beta in 3 months" },
      { key: "context", label: "Anything else", placeholder: "Anything else the agents should know" },
    ],
  },
];

const OPTIONAL_KEYS = CONTEXT_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const initialState = {
  title: "", description: "", targetUser: "", problem: "", solution: "", differentiator: "",
  businessModel: "", pricing: "", distribution: "", competitors: "", constraints: "",
  successMetric: "", timeline: "", context: "",
};

const QUICK_EXAMPLES = [
  "AI calendar for freelance designers that reads client emails and turns project deadlines into calendar blocks",
  "Cross-border payment API for African SaaS companies selling to US customers",
  "Contract review workspace for small law firms that summarizes risk and drafts client-ready revisions",
];

const QUICK_PROMPTS = [
  "Who is it for?",
  "What painful workflow changes?",
  "How will you reach the first users?",
];

const READOUT_LABELS = [
  "CONSENSUS",
  "TENSION",
  "DIFFERENTIATION & CREDIBILITY",
  "KILL SHOT REVIEW",
  "VERDICT",
  "NEXT MOVE",
];

const FULL_EXAMPLES: IdeaInput[] = [
  { title: "AI calendar assistant for freelance designers", description: "Reads client emails, proposes project timelines, and auto-creates calendar blocks.", targetUser: "Solo freelance designers using Gmail + Google Calendar", problem: "Scheduling client work is manual and error-prone.", solution: "Auto-suggest timelines and calendar blocks from client requests.", differentiator: "Designer-specific templates and client-ready timelines.", businessModel: "Subscription SaaS", pricing: "$15/mo solo, $39/mo for small studios", distribution: "Designer communities, YouTube creator partnerships", competitors: "Motion.io, Bonsai, Notion templates", constraints: "Must integrate Gmail + Google Calendar APIs", successMetric: "3+ timelines created in week one", timeline: "MVP in 6 weeks", context: "Solo dev, targeting Product Hunt launch." },
  { title: "Code review bot for pull requests", description: "AI bot reviews PRs for bugs, style, and security before humans review.", targetUser: "Small eng teams (2-10 devs) on GitHub", problem: "Reviews are slow and inconsistently catch bugs.", solution: "Inline automated review comments with priority labels.", differentiator: "Team-specific rules trained on repo history.", businessModel: "Per-seat SaaS", pricing: "$20/dev/mo", distribution: "GitHub Marketplace, DevRel", competitors: "CodeRabbit, ReviewGPT", constraints: "Must work in private repos", successMetric: "Cuts review time by 30%", timeline: "Beta in 4 weeks", context: "Selling to team leads, already on GitHub Actions." },
];

const DOSSIER_PITCHES = [
  "Scanning competitors...",
  "Pulling pricing data...",
  "Mapping the funding landscape...",
  "Finding market gaps...",
];

const ROOM_PITCHES = [
  "The VC is reading your dossier...",
  "The engineer is counting API calls...",
  "The indie hacker checked Product Hunt...",
  "Summoning the devil's advocate...",
];

function getIdea(state: typeof initialState): IdeaInput {
  const idea: Record<string, string> = {};
  for (const key of Object.keys(state) as (keyof typeof initialState)[]) {
    idea[key] = state[key].trim();
  }
  return idea as unknown as IdeaInput;
}

// --- Page ---

export default function Page() {
  return (
    <Suspense fallback={
      <div className="app">
        <main className="form-page"><p className="brief-form-sub">Loading...</p></main>
      </div>
    }>
      <BriefPage />
    </Suspense>
  );
}

function BriefPage() {
  const searchParams = useSearchParams();

  // Input state
  const [phase, setPhase] = useState<Phase>("form");
  const [mode, setMode] = useState<InputMode>(
    searchParams.get("mode") === "detailed" ? "detailed" : "quick"
  );
  const [quickInput, setQuickInput] = useState("");
  const [form, setForm] = useState(initialState);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showDetails, setShowDetails] = useState(searchParams.get("mode") === "detailed");
  const [lastIdea, setLastIdea] = useState<IdeaInput | null>(null);

  // Voice
  const voice = useQuickVoice((text) => {
    setQuickInput(text);
  });

  // Loading state
  const [loading, setLoading] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [pitchIndex, setPitchIndex] = useState(0);
  const [dossierExpanded, setDossierExpanded] = useState(true);

  // Research state
  const [researchAgents, setResearchAgents] = useState<ResearchAgentStatus[]>([]);

  // Validation state
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({});
  const [synthesis, setSynthesis] = useState<SynthesisResult | null>(null);

  // Report state
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [pricing, setPricing] = useState<any>(null);
  const [funding, setFunding] = useState<any>(null);
  const [gaps, setGaps] = useState<any>(null);
  const [distribution, setDistribution] = useState<any>(null);
  const [positioning, setPositioning] = useState<Positioning | null>(null);
  const [launch, setLaunch] = useState<LaunchStrategy | null>(null);
  const [processingTime, setProcessingTime] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setField = useCallback((key: keyof typeof initialState) => (value: string) =>
    setForm(prev => ({ ...prev, [key]: value })), []);

  // Load history
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // Pitch rotation
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setPitchIndex(i => i + 1), 2500);
    return () => clearInterval(id);
  }, [loading]);

  const hasResults = competitors.length > 0 || !!synthesis;
  const filledContext = OPTIONAL_KEYS.filter(k => form[k].trim()).length;
  const dossierTotal = Object.keys(RESEARCH_AGENTS).length;
  const roomTotal = agentOrder.length;
  const researchDone = researchAgents.filter(a => a.status === "done").length;
  const validateDone = Object.keys(agentResults).length;
  const dossierComplete = researchDone >= dossierTotal;
  const loadingPitch = dossierComplete
    ? ROOM_PITCHES[pitchIndex % ROOM_PITCHES.length]
    : DOSSIER_PITCHES[pitchIndex % DOSSIER_PITCHES.length];

  useEffect(() => {
    setPitchIndex(0);
  }, [dossierComplete]);

  const resetState = () => {
    setCompetitors([]);
    setPricing(null);
    setFunding(null);
    setGaps(null);
    setDistribution(null);
    setPositioning(null);
    setLaunch(null);
    setProcessingTime(null);
    setResearchAgents([]);
    setAgentResults({});
    setSynthesis(null);
    setError(null);
  };

  const saveToHistory = useCallback((idea: IdeaInput, agents: AgentResult[], synth: SynthesisResult) => {
    const entry: HistoryEntry = {
      title: idea.title,
      description: idea.description,
      date: new Date().toLocaleDateString(),
      verdict: extractVerdict(synth.output, synth.scores.overall) || "",
      overall: synth.scores.overall,
      agents,
      synthesis: synth,
    };
    setHistory((prev) => prependHistory(entry, prev));
  }, []);

  const handleEvent = useCallback((data: any) => {
    if (!data || typeof data !== "object") return;

    // Research events
    if (data.type === "status" && data.agent && data.status) {
      setResearchAgents((prev) => {
        const existing = prev.find((a) => a.agent === data.agent);
        if (existing) {
          return prev.map((a) =>
            a.agent === data.agent ? { ...a, status: data.status } : a
          );
        }
        return [...prev, { agent: data.agent, status: data.status }];
      });
    } else if (data.type === "competitor" && data.data) {
      setCompetitors((prev) => [...prev, data.data]);
    } else if (data.type === "pricing" && data.data) {
      setPricing(data.data);
    } else if (data.type === "funding" && data.data) {
      setFunding(data.data);
    } else if (data.type === "gaps" && data.data) {
      setGaps(data.data);
    } else if (data.type === "distribution" && data.data) {
      setDistribution(data.data);
    } else if (data.type === "positioning" && data.data) {
      setPositioning(data.data);
    } else if (data.type === "launch" && data.data) {
      setLaunch(data.data);
    }
    // Validation events
    else if (data.agent && data.output !== undefined && data.scores) {
      setAgentResults(prev => ({ ...prev, [data.agent]: data }));
    } else if (data.output !== undefined && data.scores) {
      setSynthesis(data);
    }
    // Common events
    else if (data.type === "done") {
      setProcessingTime(data.processing_time);
    } else if (data.type === "error") {
      setError(data.message);
    } else if (data.message && !data.type) {
      setError(data.message);
    }
  }, []);

  const runUnified = useCallback(async (idea: IdeaInput) => {
    setLastIdea(idea);
    setPhase("results");
    setLoading(true);
    setCancelled(false);
    setError(null);
    resetState();
    window.scrollTo({ top: 0, behavior: "smooth" });

    const controller = new AbortController();
    abortRef.current = controller;

    let localAgents: Record<string, AgentResult> = {};
    let localSynth: SynthesisResult | null = null;

    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(idea),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              handleEvent(data);

              // Track local state for history
              if (data.agent && data.output !== undefined && data.scores) {
                localAgents[data.agent] = data;
              } else if (data.output !== undefined && data.scores && !data.agent) {
                localSynth = data;
              }
            } catch (e: any) {
              if (e?.message && !(e instanceof SyntaxError)) throw e;
            }
          }
        }
      }

      setLoading(false);
      if (localSynth) saveToHistory(idea, Object.values(localAgents), localSynth);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Something went wrong");
      }
      setLoading(false);
    }
  }, [handleEvent, saveToHistory]);

  const handleQuickSubmit = () => {
    if (!quickInput.trim()) return;
    const firstSentence = quickInput.split(/[.!?\n]/)[0]?.trim() || quickInput.slice(0, 60).trim();
    setForm(prev => ({ ...prev, title: firstSentence, description: quickInput.trim() }));
    runUnified({ title: firstSentence, description: quickInput.trim() } as IdeaInput);
  };

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    voice.stop();
    runUnified(getIdea(form));
  }, [form, runUnified, voice]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setCancelled(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loading, handleCancel]);

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
  };

  const handleNew = () => {
    setQuickInput("");
    setForm(initialState);
    setOpenGroups({});
    setMode("quick");
    setShowDetails(false);
    setPhase("form");
    setError(null);
    resetState();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleEditIdea = () => {
    if (lastIdea) {
      const updates: Record<string, string> = {};
      for (const k of Object.keys(initialState) as (keyof typeof initialState)[]) {
        updates[k] = (lastIdea as any)[k] || "";
      }
      setForm(prev => ({ ...prev, ...updates }));
      setQuickInput(lastIdea.description || "");
    }
    setPhase("form");
    setMode("detailed");
    setShowDetails(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const loadHistoryEntry = (entry: HistoryEntry) => {
    const agents: Record<string, AgentResult> = {};
    for (const a of entry.agents) agents[a.agent] = a;
    setAgentResults(agents);
    setSynthesis(entry.synthesis);
    setLastIdea({ title: entry.title, description: entry.description });
    setQuickInput(entry.description || "");
    setForm(prev => ({ ...prev, title: entry.title, description: entry.description }));
    setError(null);
    setLoading(false);
    setPhase("results");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const fillFullExample = (ex: IdeaInput) => {
    const updates: Record<string, string> = {};
    for (const k of Object.keys(initialState) as (keyof typeof initialState)[]) {
      updates[k] = (ex as any)[k] || "";
    }
    setForm(prev => ({ ...prev, ...updates }));
    setQuickInput(ex.description || "");
    setOpenGroups({ user: true, business: true, gtm: true });
  };

  const verdict = synthesis ? extractVerdict(synthesis.output, synthesis.scores.overall) : null;
  const synthesisText = synthesis ? stripStructuredBlocks(synthesis.output) : "";
  const displayTitle =
    positioning?.category ||
    (lastIdea?.title && lastIdea.title.length <= 90 ? lastIdea.title : "Startup briefing");
  const ideaExcerpt = lastIdea?.description || lastIdea?.title || "";
  const readoutSections = (() => {
    if (!synthesisText) return [];
    const matches = [...synthesisText.matchAll(/(?:^|\n)\s*(?:\d+\.\s*)?\*?\*?([A-Z][A-Z &]+)\*?\*?\s*[—:-]\s*([\s\S]*?)(?=\n\s*(?:\d+\.\s*)?\*?\*?(?:CONSENSUS|TENSION|DIFFERENTIATION & CREDIBILITY|KILL SHOT REVIEW|VERDICT|NEXT MOVE)\*?\*?\s*[—:-]|$)/g)];
    return matches
      .map((m) => ({ label: m[1].trim(), body: m[2].trim() }))
      .filter((section) => READOUT_LABELS.includes(section.label));
  })();

  const pivotMatch = (() => {
    if (!synthesisText || verdict !== "PIVOT") return null;
    const lines = synthesisText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes("pivot"))
        return lines.slice(i, i + 3).join("\n").trim();
    }
    return null;
  })();

  const handleCopy = () => {
    navigator.clipboard.writeText(`${verdict || ""} — ${lastIdea?.title || ""}\n\n${synthesisText}`.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="app">
      {/* ===== NAV ===== */}
      <nav className="topnav">
        <Link href="/" className="wordmark">
          FOUNDER<span className="wordmark-slash">/</span>BRIEF
        </Link>
        {phase === "results" && (
          <div className="topnav-actions">
            <button className="nav-btn" onClick={handleEditIdea} disabled={loading}>Edit idea</button>
            <button className="nav-btn nav-btn-accent" onClick={handleNew} disabled={loading}>New briefing</button>
          </div>
        )}
      </nav>

      {/* ===== FORM PHASE ===== */}
      {phase === "form" && (
        <main className="form-page">
          {/* Quick mode (default) */}
          {mode === "quick" && !showDetails && (
            <div className="research-quick">
              <div className="brief-form-header">
                <div className="brief-step-kicker">Step 1 · Input</div>
                <h1 className="brief-form-title">Your idea</h1>
                <p className="brief-form-sub">
                  Give us the product, customer, and painful workflow. We&apos;ll research the market,
                  score the idea, and return a verdict you can act on.
                </p>
              </div>

              <div className="briefing-console form-console">
                <div className="console-toolbar subtle">
                  <span className="console-status idle">NEW BRIEFING</span>
                  <strong>Describe the startup</strong>
                  <em>Act 1 + 2</em>
                </div>
                <div className="console-body form-console-body">
              <div className="quick-guidance" aria-label="What to include">
                {QUICK_PROMPTS.map((prompt) => (
                  <span key={prompt}>{prompt}</span>
                ))}
              </div>

              <div className="quick-input-area">
                <div className="quick-textarea-wrap">
                  <textarea
                    className="quick-textarea"
                    value={quickInput}
                    onChange={(e) => setQuickInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleQuickSubmit();
                      }
                    }}
                    placeholder="e.g., AI calendar assistant for freelance designers that reads client emails and schedules project timelines automatically"
                    rows={3}
                    aria-label="Describe your startup idea"
                  />
                  {voice.supported && (
                    <button
                      className={`mic-btn ${voice.listening ? "listening" : ""}`}
                      onClick={voice.listening ? voice.stop : () => voice.start(quickInput)}
                      aria-label={voice.listening ? "Stop voice input" : "Start voice input"}
                      title={voice.listening ? "Stop dictation" : "Dictate your idea"}
                    >
                      {voice.listening ? <Square size={14} /> : <Mic size={14} />}
                    </button>
                  )}
                  {voice.listening && (
                    <div className="mic-live" aria-live="polite">
                      <span className="mic-live-dot" />
                      <span className={`mic-live-text ${voice.interimText ? "has-text" : ""}`}>
                        {voice.interimText || "Listening... speak clearly and pause to commit words"}
                      </span>
                      <span className="mic-live-stop">Tap square to stop</span>
                    </div>
                  )}
                  {voice.error && <div className="mic-error" role="alert">{voice.error}</div>}
                </div>
                <button
                  className="quick-submit"
                  onClick={handleQuickSubmit}
                  disabled={!quickInput.trim() || loading}
                >
                  Run briefing <ArrowRight size={16} />
                </button>
              </div>

              <button
                className="toggle-mode-btn"
                onClick={() => { setMode("detailed"); setShowDetails(true); }}
              >
                Add more detail for a sharper briefing
              </button>

              <div className="quick-examples">
                <span className="examples-label">TRY:</span>
                {QUICK_EXAMPLES.map((ex) => (
                  <button key={ex} className="example-btn" onClick={() => setQuickInput(ex)}>
                    {ex}
                  </button>
                ))}
              </div>

              <div className="submit-meta">No account · usually under a minute</div>
                </div>
              </div>

              <div className="quick-output-preview outside-console" aria-label="Briefing output">
                <div>
                  <strong>Act 1</strong>
                  <span>Market dossier</span>
                </div>
                <div>
                  <strong>Act 2</strong>
                  <span>Expert room</span>
                </div>
                <div>
                  <strong>Verdict</strong>
                  <span>Ship, pivot, or kill</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed mode */}
          {(mode === "detailed" || showDetails) && (
            <div className="research-detailed">
              <div className="detailed-header">
                <button
                  className="back-btn"
                  onClick={() => { setMode("quick"); setShowDetails(false); }}
                >
                  <ChevronLeft size={14} /> Back
                </button>
                <div className="brief-step-kicker">Step 1 · Detailed input</div>
                <h1 className="brief-form-title">Detailed briefing</h1>
                <p className="brief-form-sub">
                  More context = sharper dossier and a tougher room. Title and description required.
                </p>
              </div>

              <div className="briefing-console form-console">
                <div className="console-toolbar subtle">
                  <span className="console-status idle">STRUCTURED BRIEF</span>
                  <strong>Full founder context</strong>
                  <em>{filledContext}/{OPTIONAL_KEYS.length} fields</em>
                </div>
                <div className="console-body form-console-body">
              <form className="detailed-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="d-title">Idea Title *</label>
                  <input
                    id="d-title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setField("title")(e.target.value)}
                    placeholder='One line. "AI-powered resume builder"'
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="d-desc">Description *</label>
                  <textarea
                    id="d-desc"
                    value={form.description}
                    onChange={(e) => setField("description")(e.target.value)}
                    placeholder="Describe the product and the workflow end to end. Vague in, vague out."
                    rows={4}
                  />
                </div>

                <div className="context-header">
                  <span className="context-label">Optional context</span>
                  <span className="context-meter">{filledContext}/{OPTIONAL_KEYS.length} filled</span>
                </div>

                {CONTEXT_GROUPS.map(group => {
                  const filled = group.fields.filter(f => form[f.key].trim()).length;
                  const open = !!openGroups[group.id];
                  return (
                    <div key={group.id} className={`context-group ${open ? "open" : ""}`}>
                      <button
                        type="button"
                        className="context-toggle"
                        onClick={() => setOpenGroups(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                      >
                        <span className="context-toggle-chevron">{open ? "\u2212" : "+"}</span>
                        <span className="context-toggle-label">{group.label}</span>
                        <span className="context-toggle-hint">
                          {filled > 0 ? `${filled}/${group.fields.length} filled` : group.hint}
                        </span>
                      </button>
                      {open && (
                        <div className="context-fields">
                          {group.fields.map(f => (
                            <div key={f.key} className={`field ${f.textarea ? "field-wide" : ""}`}>
                              <label htmlFor={f.key}>{f.label}</label>
                              {f.textarea ? (
                                <textarea
                                  id={f.key}
                                  value={form[f.key]}
                                  onChange={(e) => setField(f.key)(e.target.value)}
                                  placeholder={f.placeholder}
                                  rows={3}
                                />
                              ) : (
                                <input
                                  id={f.key}
                                  type="text"
                                  value={form[f.key]}
                                  onChange={(e) => setField(f.key)(e.target.value)}
                                  placeholder={f.placeholder}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="submit" className="submit-btn" disabled={!form.title.trim() || !form.description.trim() || loading}>
                  {loading ? "Running briefing..." : "Run briefing"}
                </button>
                <div className="submit-meta">~60 seconds · ship, pivot, or kill</div>
              </form>
                </div>
              </div>

              <div className="examples">
                <span className="examples-label">OR STRESS-TEST AN EXAMPLE</span>
                <div className="examples-row">
                  {FULL_EXAMPLES.map((ex, i) => (
                    <button key={i} type="button" className="example-chip" onClick={() => fillFullExample(ex)}>
                      {ex.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-banner">{error}</div>}
          <HistoryPanel entries={history} onSelect={loadHistoryEntry} onClear={handleClearHistory} />
        </main>
      )}

      {/* ===== RESULTS PHASE ===== */}
      {phase === "results" && (
        <main className="results-page" ref={resultsRef}>
          {/* Loading */}
          {loading && (
            <div className="briefing-console loading-console">
              <div className="console-toolbar">
                <span className="console-status running"><i className="live-dot" /> RUNNING BRIEFING</span>
                <strong>{lastIdea?.title || "Your idea"}</strong>
                <em>{researchDone + validateDone}/{dossierTotal + roomTotal}</em>
              </div>
              <div className="console-body">
            <div className="research-progress">
              <div className="progress-header">
                <h2>{dossierComplete ? "Act 2 — The room" : "Act 1 — Building your dossier"}</h2>
                <p className="progress-subtitle">
                  {dossierComplete
                    ? `${validateDone}/${roomTotal} experts reported`
                    : `${researchDone}/${dossierTotal} scans complete`}
                </p>
              </div>

              <div className={`act-panel ${!dossierComplete ? "active" : "done"}`}>
                <div className="act-phase">
                  <div className={`act-phase-label ${!dossierComplete ? "active" : "done"}`}>
                    Act 1 · The dossier
                  </div>
                  <div className="agent-roster" role="status" aria-live="polite">
                    {Object.entries(RESEARCH_AGENTS).map(([key, { label, icon }]) => {
                      const status = researchAgents.find((a) => a.agent === key);
                      return (
                        <div key={key} className={`agent-chip ${status?.status || "pending"}`}>
                          <span className="icon">{icon}</span>
                          <span className="label">{label}</span>
                          <span className="status">
                            {status?.status === "done" ? "\u2713" : status?.status !== "pending" ? "..." : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className={`act-panel ${dossierComplete ? "active" : "pending"}`}>
                <div className="act-phase">
                  <div className={`act-phase-label ${dossierComplete ? "active" : "pending"}`}>
                    Act 2 · The room
                  </div>
                  <div className="agent-roster" role="status" aria-live="polite">
                    {agentOrder.map((name) => {
                      const meta = agentMetaMap[name];
                      const result = agentResults[name];
                      return (
                        <div key={name} className={`agent-chip ${result ? (result.error ? "failed" : "done") : dossierComplete ? "pending" : "waiting"}`}>
                          <span className="icon" style={{ color: meta.color }}>{meta.icon}</span>
                          <span className="label">{meta.label}</span>
                          <span className="status">
                            {result ? (result.error ? "\u2715" : "\u2713") : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="progress-track">
                <div className="progress-segment">
                  <div className="progress-fill dossier" style={{ width: `${Math.min((researchDone / dossierTotal) * 100, 100)}%` }} />
                  <span className="progress-label">Act 1 · Dossier</span>
                </div>
                <div className="progress-segment">
                  <div className="progress-fill room" style={{ width: `${Math.min((validateDone / roomTotal) * 100, 100)}%` }} />
                  <span className="progress-label">Act 2 · Room</span>
                </div>
              </div>

              <p className="loading-quip">{loadingPitch}</p>

              <button className="cancel-btn" onClick={handleCancel}>
                <X size={14} /> Cancel
              </button>
            </div>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              {lastIdea && (
                <button className="error-retry" onClick={() => runUnified(lastIdea)}>Retry</button>
              )}
            </div>
          )}

          {cancelled && !hasResults && (
            <div className="error-banner">
              <span>Cancelled.</span>
              <button onClick={() => setCancelled(false)}>Dismiss</button>
            </div>
          )}

          {/* Report */}
          {hasResults && !loading && (
            <ReportErrorBoundary>
              <div className="briefing-console report-console">
                <div className="console-toolbar complete">
                  <span className="console-status done">BRIEFING COMPLETE</span>
                  <strong>{displayTitle}</strong>
                  {processingTime ? <em>{processingTime}</em> : <em>Ready</em>}
                </div>
                <div className="console-body">
              <div className="research-report">
                {/* Header */}
                <div className="report-header compact">
                  <div className="report-kicker">Final output</div>
                  {positioning?.one_liner && (
                    <p className="one-liner">{positioning.one_liner}</p>
                  )}
                  {ideaExcerpt && (
                    <p className="idea-excerpt">{ideaExcerpt}</p>
                  )}
                </div>

                {/* Verdict */}
                {synthesis && (
                  <>
                    <VerdictBanner verdict={verdict} overall={synthesis.scores.overall} onCopy={handleCopy} copied={copied} />
                    <Scorecard scores={synthesis.scores} />
                    {pivotMatch && (
                      <div className="pivot-box">
                        <div className="pivot-label">Next move</div>
                        <div className="pivot-text">{pivotMatch}</div>
                      </div>
                    )}
                    <section className="report-section verdict-section" aria-label="Why">
                      <h2>The readout</h2>
                      {readoutSections.length > 0 ? (
                        <div className="readout-grid">
                          {readoutSections.map((section) => (
                            <article key={section.label} className={`readout-card ${section.label === "KILL SHOT REVIEW" ? "danger" : ""}`}>
                              <div className="readout-label">{section.label}</div>
                              <p>{section.body}</p>
                            </article>
                          ))}
                        </div>
                      ) : (
                        <div className="synthesis-content">{synthesisText}</div>
                      )}
                    </section>
                  </>
                )}

                {/* Summary strip */}
                {positioning && (
                  <div className="summary-strip">
                    <div className="summary-item">
                      <span className="summary-label">Category</span>
                      <span className="summary-value">{positioning.category}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Target</span>
                      <span className="summary-value">{positioning.target_user}</span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Edge</span>
                      <span className="summary-value">{positioning.competitive_advantage}</span>
                    </div>
                  </div>
                )}

                {/* === ACT 1: THE DOSSIER === */}
                {(competitors.length > 0 || pricing || funding || gaps || distribution || positioning || launch) && (
                  <div className="report-act">
                    <button
                      type="button"
                      className="report-act-toggle"
                      onClick={() => setDossierExpanded(v => !v)}
                      aria-expanded={dossierExpanded}
                    >
                      <span className="report-act-label">Act 1 · The dossier</span>
                      <span className="report-act-hint">{dossierExpanded ? "Collapse" : "Expand"}</span>
                    </button>
                    {dossierExpanded && (
                      <div className="report-act-body">
                {competitors.length > 0 && (
                  <section className="report-section" aria-label="Competitors">
                    <h2><Search size={16} /> Competitors ({competitors.length})</h2>
                    <div className="competitor-grid">
                      {competitors.map((c, i) => (
                        <div key={c.url || c.name || i} className="competitor-card">
                          <h3>{c.name}</h3>
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="competitor-url">{c.url}</a>
                          <p>{c.description}</p>
                          {c.pricing && <div className="competitor-detail"><strong>Pricing:</strong> {c.pricing}</div>}
                          {c.funding && <div className="competitor-detail"><strong>Funding:</strong> {c.funding}</div>}
                          {c.employees && <div className="competitor-detail"><strong>Team:</strong> {c.employees}</div>}
                          {c.strengths?.length > 0 && (
                            <div className="strengths"><strong>Strengths:</strong><ul>{c.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul></div>
                          )}
                          {c.weaknesses?.length > 0 && (
                            <div className="weaknesses"><strong>Weaknesses:</strong><ul>{c.weaknesses.map((w, j) => <li key={j}>{w}</li>)}</ul></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Pricing */}
                {pricing && (
                  <section className="report-section" aria-label="Pricing">
                    <h2><DollarSign size={16} /> Pricing Landscape</h2>
                    {pricing.competitors?.length > 0 && (
                      <div className="pricing-grid">
                        {pricing.competitors.map((p: any, i: number) => (
                          <div key={p.name || i} className="pricing-card">
                            <h3>{p.name}</h3>
                            {p.tiers?.map((t: any, j: number) => (
                              <div key={j} className="pricing-tier">
                                <span className="tier-name">{t.name}</span>
                                <span className="tier-price">{t.price === 0 ? "Free" : `$${t.price}/mo`}</span>
                                <span className="tier-features">{t.features}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                    {pricing.recommended_positioning && (
                      <div className="pricing-recommendation"><strong>Recommendation:</strong> {pricing.recommended_positioning}</div>
                    )}
                  </section>
                )}

                {/* Funding & Market */}
                {funding && (
                  <section className="report-section" aria-label="Market Data">
                    <h2><TrendingUp size={16} /> Market & Funding</h2>
                    {funding.market_size && (
                      <div className="market-size-card">
                        <h3>Market Size</h3>
                        {funding.market_size.tam && <div className="market-row"><span className="market-label">TAM</span><span className="market-value">{funding.market_size.tam}</span></div>}
                        {funding.market_size.sam && <div className="market-row"><span className="market-label">SAM</span><span className="market-value">{funding.market_size.sam}</span></div>}
                        {funding.market_size.som && <div className="market-row"><span className="market-label">SOM</span><span className="market-value">{funding.market_size.som}</span></div>}
                      </div>
                    )}
                    {funding.funding_landscape?.notable_rounds?.length > 0 && (
                      <div className="funding-rounds">
                        <h3>Notable Funding Rounds</h3>
                        {funding.funding_landscape.notable_rounds.map((r: any, i: number) => (
                          <div key={i} className="funding-round">
                            <strong>{r.company}</strong> — {r.amount} ({r.round})
                            {r.date && <span className="funding-date">{r.date}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {funding.funding_landscape?.hot_areas?.length > 0 && (
                      <div className="hot-areas">
                        <h3>Hot Areas</h3>
                        <div className="tag-list">
                          {funding.funding_landscape.hot_areas.map((area: string, i: number) => (
                            <span key={i} className="tag">{area}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Market Gaps */}
                {gaps && (
                  <section className="report-section" aria-label="Market Gaps">
                    <h2><Target size={16} /> Market Gaps</h2>
                    {gaps.pain_points?.length > 0 && (
                      <div className="pain-points">
                        <h3>User Pain Points</h3>
                        {gaps.pain_points.map((p: any, i: number) => (
                          <div key={i} className="pain-point">
                            <p>{p.point}</p>
                            <span className="frequency">{p.frequency}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {gaps.gaps?.length > 0 && (
                      <div className="market-gaps">
                        <h3>Underserved Areas</h3>
                        {gaps.gaps.map((g: any, i: number) => (
                          <div key={i} className="gap-item">
                            <p>{g.gap}</p>
                            <span className={`opp-size ${g.opportunity_size?.toLowerCase()}`}>{g.opportunity_size} opportunity</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {gaps.unserved_segments?.length > 0 && (
                      <div className="unserved-segments">
                        <h3>Unserved Segments</h3>
                        {gaps.unserved_segments.map((s: any, i: number) => (
                          <div key={i} className="segment-item">
                            <strong>{s.segment}</strong>
                            <p>{s.why_underserved}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Distribution */}
                {distribution && (
                  <section className="report-section" aria-label="Distribution">
                    <h2><Megaphone size={16} /> Distribution</h2>
                    {distribution.communities?.length > 0 && (
                      <div className="communities">
                        <h3><Users size={14} /> Communities</h3>
                        <div className="community-grid">
                          {distribution.communities.map((c: any, i: number) => (
                            <div key={i} className="community-card">
                              <strong>{c.name}</strong>
                              <span className="community-size">{c.size}</span>
                              {c.url && (
                                <a href={c.url} target="_blank" rel="noopener noreferrer" className="community-link">
                                  <Globe size={12} />
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {distribution.distribution_channels?.length > 0 && (
                      <div className="channels">
                        <h3><MapPin size={14} /> Channels</h3>
                        {distribution.distribution_channels.map((ch: any, i: number) => (
                          <div key={i} className="channel-item">
                            <strong>{ch.channel}</strong>
                            <p>{ch.effectiveness}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {distribution.content_opportunities?.length > 0 && (
                      <div className="content-opps">
                        <h3>Content Opportunities</h3>
                        <ul>{distribution.content_opportunities.map((opp: string, i: number) => <li key={i}>{opp}</li>)}</ul>
                      </div>
                    )}
                  </section>
                )}

                {/* Positioning */}
                {positioning && (
                  <section className="report-section" aria-label="Positioning">
                    <h2><Compass size={16} /> Positioning</h2>
                    <div className="positioning-card">
                      <div className="positioning-row"><strong>One-liner:</strong> {positioning.one_liner}</div>
                      <div className="positioning-row"><strong>Category:</strong> {positioning.category}</div>
                      <div className="positioning-row"><strong>Target:</strong> {positioning.target_user}</div>
                      <div className="positioning-row"><strong>Differentiation:</strong> {positioning.differentiation}</div>
                      <div className="positioning-row"><strong>Why Now:</strong> {positioning.why_now}</div>
                      <div className="positioning-row"><strong>Competitive Advantage:</strong> {positioning.competitive_advantage}</div>
                    </div>
                  </section>
                )}

                {/* Launch Strategy */}
                {launch && (
                  <section className="report-section" aria-label="Launch Strategy">
                    <h2><Rocket size={16} /> Launch Strategy</h2>
                    <div className="launch-timeline">
                      {([
                        { key: "phase_1_pre_launch", label: "Pre-Launch", icon: <ChevronLeft size={16} /> },
                        { key: "phase_2_launch", label: "Launch Week", icon: <Target size={16} /> },
                        { key: "phase_3_post_launch", label: "Post-Launch", icon: <Rocket size={16} /> },
                      ] as const).map(({ key, label, icon }) => {
                        const phase = launch[key] as any;
                        if (!phase?.actions?.length) return null;
                        return (
                          <div key={key} className="launch-phase">
                            <h3>{icon} {label}</h3>
                            <span className="timeline">{phase.timeline}</span>
                            <ul>{phase.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul>
                          </div>
                        );
                      })}
                    </div>
                    {launch.kpis?.length > 0 && (
                      <div className="kpis">
                        <h3>KPIs</h3>
                        <ul>{launch.kpis.map((kpi: string, i: number) => <li key={i}>{kpi}</li>)}</ul>
                      </div>
                    )}
                  </section>
                )}

                      </div>
                    )}
                  </div>
                )}

                {/* === ACT 2: THE ROOM === */}

                <section className="agents-section report-act-room">
                  <div className="report-act-label static">Act 2 · The room</div>
                  <p className="report-act-desc">Seven experts stress-tested your idea against the dossier.</p>
                  {agentOrder.map(name => (
                    <AgentCard
                      key={name}
                      name={name}
                      result={agentResults[name]}
                      loading={loading && !agentResults[name]}
                      collapsed={collapsed[name] ?? !agentMetaMap[name]?.isDevil}
                      onToggle={() => setCollapsed(prev => ({ ...prev, [name]: !(prev[name] ?? !agentMetaMap[name]?.isDevil) }))}
                    />
                  ))}
                </section>

                {/* Footer */}
                <div className="report-footer">
                  <button className="start-over-btn" onClick={handleNew}>
                    Run another briefing
                  </button>
                </div>
              </div>
                </div>
              </div>
            </ReportErrorBoundary>
          )}

          <HistoryPanel entries={history} onSelect={loadHistoryEntry} onClear={handleClearHistory} />
          <footer className="footer">Founder Brief — dossier + verdict. Not financial advice.</footer>
        </main>
      )}
    </div>
  );
}
