"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  Globe,
  Code,
  Box,
  Users,
  TrendingUp,
  Scale,
  Zap,
} from "lucide-react";

interface Particle {
  x: number;
  y: number;
  progress: number;
  speed: number;
  size: number;
  color: string;
  agentIdx: number;
}

type Sequence = "idle" | "wakeup" | "transmit" | "saturate" | "flash" | "finalized";

/* ─── Agent definitions ─── */
const AGENTS = [
  {
    id: "market",
    label: "MARKET RESEARCH",
    Icon: Globe,
    color: "#ff5a2b",
    // Percentage-based positions relative to container
    top: "4%",
    left: "3%",
    side: "left" as const,
  },
  {
    id: "engineer",
    label: "STAFF ENGINEER",
    Icon: Code,
    color: "#22d3ee",
    top: "35%",
    left: "0%",
    side: "left" as const,
  },
  {
    id: "product",
    label: "PRODUCT LEAD",
    Icon: Box,
    color: "#60a5fa",
    top: "68%",
    left: "3%",
    side: "left" as const,
  },
  {
    id: "vc",
    label: "VC PARTNER",
    Icon: Users,
    color: "#a78bfa",
    top: "4%",
    right: "3%",
    side: "right" as const,
  },
  {
    id: "growth",
    label: "GROWTH ADVISOR",
    Icon: TrendingUp,
    color: "#34d399",
    top: "35%",
    right: "0%",
    side: "right" as const,
  },
  {
    id: "judge",
    label: "JUDGE DEBATE",
    Icon: Scale,
    color: "#fbbf24",
    top: "68%",
    right: "3%",
    side: "right" as const,
  },
];

export default function AgentOrb() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [sequence, setSequence] = useState<Sequence>("idle");
  const [activeAgentIndex, setActiveAgentIndex] = useState(-1);
  const [verdictScore, setVerdictScore] = useState(0);

  // Spring-based mouse parallax
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { damping: 30, stiffness: 100, mass: 1 };
  const parallaxX = useSpring(mouseX, springCfg);
  const parallaxY = useSpring(mouseY, springCfg);

  const transCore = useTransform(parallaxX, (v) =>
    `translateX(${v * 15}px) translateY(${parallaxY.get() * 15}px)`
  );
  const transCardsLeft = useTransform(parallaxX, (v) =>
    `translateX(${v * 8}px) translateY(${parallaxY.get() * 8}px)`
  );
  const transCardsRight = useTransform(parallaxX, (v) =>
    `translateX(${v * 12}px) translateY(${parallaxY.get() * 12}px)`
  );

  /* ─── Mouse tracking ─── */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - r.left) / r.width - 0.5);
      mouseY.set((e.clientY - r.top) / r.height - 0.5);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  /* ─── Storytelling timeline (loops) ─── */
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const runLoop = () => {
      setSequence("idle");
      setActiveAgentIndex(-1);
      setVerdictScore(0);

      timers.push(
        setTimeout(() => {
          setSequence("wakeup");
          let cur = 0;
          const iv = setInterval(() => {
            setActiveAgentIndex(cur);
            cur++;
            if (cur >= 6) {
              clearInterval(iv);
              timers.push(
                setTimeout(() => {
                  setSequence("transmit");
                  timers.push(
                    setTimeout(() => {
                      setSequence("saturate");
                      timers.push(
                        setTimeout(() => {
                          setSequence("flash");
                          timers.push(
                            setTimeout(() => {
                              setSequence("finalized");
                              let sv = 0;
                              const siv = setInterval(() => {
                                sv += 2;
                                if (sv >= 88) {
                                  setVerdictScore(88);
                                  clearInterval(siv);
                                } else setVerdictScore(sv);
                              }, 20);
                              intervals.push(siv);
                              timers.push(setTimeout(runLoop, 6000));
                            }, 400)
                          );
                        }, 4000)
                      );
                    }, 3000)
                  );
                }, 1000)
              );
            }
          }, 600);
          intervals.push(iv);
        }, 2000)
      );
    };

    runLoop();
    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
  }, []);

  /* ─── Canvas particle engine ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];

    const updateSize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);

    // Compute agent centers from percentage positions relative to container
    const getAgentCoords = () => {
      const w = canvas.width;
      const h = canvas.height;
      return AGENTS.map((a) => {
        const top = parseFloat(a.top) / 100;
        // Approximate card center offsets (card is ~160px wide, ~90px tall)
        const cardCenterYOffset = 45;
        const cardCenterXOffset = 80;
        let x: number;
        if (a.side === "left") {
          x = (parseFloat(a.left || "0") / 100) * w + cardCenterXOffset;
        } else {
          x = w - (parseFloat(a.right || "0") / 100) * w - cardCenterXOffset;
        }
        const y = top * h + cardCenterYOffset;
        return { x, y, color: a.color };
      });
    };

    const getCenter = () => ({
      x: canvas.width * 0.5,
      y: canvas.height * 0.42,
    });

    const drawStream = (
      x1: number, y1: number, x2: number, y2: number,
      active: boolean, color: string
    ) => {
      const cp1x = x1 + (x2 - x1) * 0.4;
      const cp1y = y1;
      const cp2x = x1 + (x2 - x1) * 0.6;
      const cp2y = y2;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);

      let opacity = 0.04;
      if (active) {
        if (sequence === "transmit") opacity = 0.2;
        else if (sequence === "saturate") opacity = 0.35;
        else if (sequence === "finalized") opacity = 0.12;
        else opacity = 0.1;
      }
      ctx.strokeStyle = active
        ? `${color}${Math.floor(opacity * 255).toString(16).padStart(2, "0")}`
        : "rgba(255,255,255,0.015)";
      ctx.lineWidth = active ? 1.2 : 0.8;
      ctx.stroke();
    };

    const tick = () => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const center = getCenter();
      const coords = getAgentCoords();

      // Spawn particles
      if (sequence === "transmit" || sequence === "saturate") {
        const rate = sequence === "saturate" ? 0.3 : 0.1;
        if (Math.random() < rate) {
          const idx = Math.floor(Math.random() * coords.length);
          particles.push({
            x: coords[idx].x,
            y: coords[idx].y,
            progress: 0,
            speed: 0.012 + Math.random() * 0.018,
            size: Math.random() * 2.5 + 1.5,
            color: coords[idx].color,
            agentIdx: idx,
          });
        }
      } else if (sequence === "wakeup" && activeAgentIndex >= 0) {
        if (Math.random() < 0.03) {
          const idx = Math.floor(Math.random() * Math.min(activeAgentIndex + 1, coords.length));
          particles.push({
            x: coords[idx].x,
            y: coords[idx].y,
            progress: 0,
            speed: 0.005 + Math.random() * 0.01,
            size: Math.random() * 2 + 1,
            color: coords[idx].color,
            agentIdx: idx,
          });
        }
      }

      // Draw stream connections
      coords.forEach((c, i) => {
        const awake = sequence === "wakeup" ? i <= activeAgentIndex : sequence !== "idle";
        drawStream(c.x, c.y, center.x, center.y, awake, c.color);
      });

      // Update & draw particles along bezier
      particles = particles.filter((p) => {
        p.progress += p.speed;
        if (p.progress >= 1) return false;

        const start = coords[p.agentIdx] || coords[0];
        const cp1x = start.x + (center.x - start.x) * 0.4;
        const cp1y = start.y;
        const cp2x = start.x + (center.x - start.x) * 0.6;
        const cp2y = center.y;

        const t = p.progress;
        const mt = 1 - t;
        const px = mt ** 3 * start.x + 3 * mt ** 2 * t * cp1x + 3 * mt * t ** 2 * cp2x + t ** 3 * center.x;
        const py = mt ** 3 * start.y + 3 * mt ** 2 * t * cp1y + 3 * mt * t ** 2 * cp2y + t ** 3 * center.y;

        ctx.fillStyle = p.color;
        ctx.shadowBlur = 12;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        return true;
      });

      // Floor ripple
      if (sequence === "saturate" || sequence === "flash" || sequence === "finalized") {
        ctx.strokeStyle = "rgba(255, 90, 43, 0.05)";
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y + h * 0.2, w * 0.2, h * 0.04, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      animId = requestAnimationFrame(tick);
    };

    tick();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateSize);
    };
  }, [sequence, activeAgentIndex]);

  /* ─── Helpers ─── */
  const isAwake = (idx: number) =>
    sequence === "wakeup" ? activeAgentIndex >= idx : sequence !== "idle";
  const isProcessing = sequence === "transmit" || sequence === "saturate" || sequence === "finalized";

  return (
    <div
      ref={containerRef}
      className="aorb-root"
      style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxWidth: 620 }}
    >
      {/* Soft radial glow background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, rgba(255,90,43,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Canvas for particle streams */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, display: "block", pointerEvents: "none", zIndex: 10 }}
      />

      {/* Concentric rotating rings (pedestal) */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "60%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        {/* Outer ring */}
        <div
          style={{
            width: 280,
            height: 60,
            borderRadius: "50%",
            border: "1px solid rgba(255, 90, 43, 0.08)",
            animation: "spin 18s linear infinite",
          }}
        />
        {/* Dashed scanning ring */}
        <div
          style={{
            width: 210,
            height: 46,
            borderRadius: "50%",
            border: "1px dashed rgba(34, 211, 238, 0.12)",
            position: "absolute",
            top: 7,
            left: 35,
            animation: "spin 8s linear infinite",
          }}
        />
        {/* Inner fast ring */}
        <div
          style={{
            width: 150,
            height: 30,
            borderRadius: "50%",
            border: "1.5px solid rgba(255, 90, 43, 0.2)",
            position: "absolute",
            top: 15,
            left: 65,
            animation: "spin 4s linear infinite",
          }}
        />
        {/* Volumetric light beam */}
        <div
          style={{
            width: 100,
            height: 200,
            background: "linear-gradient(to top, rgba(255,90,43,0.1), rgba(255,90,43,0.02), transparent)",
            position: "absolute",
            top: -175,
            left: 90,
            filter: "blur(12px)",
            borderRadius: "50%",
            pointerEvents: "none",
            animation: "pulse-slow 4s ease-in-out infinite",
          }}
        />
      </div>

      {/* THE CORE CUBE */}
      <motion.div
        style={{
          transform: transCore,
          position: "absolute",
          left: "50%",
          top: "42%",
          marginLeft: -44,
          marginTop: -44,
          zIndex: 20,
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "relative", width: 88, height: 88, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* Flash effect */}
          {sequence === "flash" && (
            <motion.div
              initial={{ scale: 0.1, opacity: 0.9 }}
              animate={{ scale: 10, opacity: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                position: "absolute",
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "white",
                mixBlendMode: "screen",
                boxShadow: "0 0 80px #fff",
                zIndex: 30,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Pulsing core glow */}
          <div
            style={{
              position: "absolute",
              width: 48,
              height: 48,
              borderRadius: "50%",
              filter: "blur(16px)",
              transition: "all 0.7s",
              background:
                sequence === "idle" ? "rgba(255, 90, 43, 0.3)" :
                sequence === "wakeup" ? "rgba(255, 90, 43, 0.5)" :
                sequence === "saturate" ? "rgba(251, 191, 36, 0.8)" :
                "rgba(251, 191, 36, 0.9)",
              transform:
                sequence === "saturate" ? "scale(1.4)" :
                sequence === "finalized" ? "scale(1.5)" :
                sequence === "wakeup" ? "scale(1.1)" : "scale(1)",
              boxShadow: sequence === "finalized" ? "0 0 40px #f59e0b" : "none",
            }}
          />

          {/* 3D CSS Cube */}
          <div
            style={{
              width: 56,
              height: 56,
              position: "relative",
              perspective: 800,
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                position: "relative",
                transformStyle: "preserve-3d",
                animation: "spin 7s linear infinite",
              }}
            >
              {[
                { t: "rotateY(0deg) translateZ(28px)", c: "rgba(255, 90, 43, 0.4)", bg: "rgba(255, 90, 43, 0.05)" },
                { t: "rotateY(90deg) translateZ(28px)", c: "rgba(255, 90, 43, 0.4)", bg: "rgba(255, 90, 43, 0.05)" },
                { t: "rotateY(180deg) translateZ(28px)", c: "rgba(255, 90, 43, 0.4)", bg: "rgba(255, 90, 43, 0.05)" },
                { t: "rotateY(270deg) translateZ(28px)", c: "rgba(255, 90, 43, 0.4)", bg: "rgba(255, 90, 43, 0.05)" },
                { t: "rotateX(90deg) translateZ(28px)", c: "rgba(34, 211, 238, 0.3)", bg: "rgba(34, 211, 238, 0.05)" },
                { t: "rotateX(-90deg) translateZ(28px)", c: "rgba(34, 211, 238, 0.3)", bg: "rgba(34, 211, 238, 0.05)" },
              ].map((face, i) => (
                <div
                  key={i}
                  style={{
                    position: "absolute",
                    inset: 0,
                    border: `2px solid ${face.c}`,
                    borderRadius: 8,
                    background: face.bg,
                    transform: face.t,
                    backfaceVisibility: "visible",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,0.2)" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Orbiting rings */}
          <div style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", border: "1px solid rgba(255,90,43,0.08)", animation: "spin 3s linear infinite", transform: "rotate(12deg)" }} />
          <div style={{ position: "absolute", width: 96, height: 96, borderRadius: "50%", border: "1px solid rgba(168,85,250,0.08)", animation: "spin 5s linear reverse infinite", transform: "rotate(-45deg)" }} />

          {/* Status label */}
          <div
            style={{
              position: "absolute",
              top: -40,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(9,9,11,0.92)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#e4e4e7",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#f97316", animation: "pulse 2s ease-in-out infinite" }} />
            <span>
              {sequence === "idle" && "Standby Core"}
              {sequence === "wakeup" && "Syncing agents..."}
              {sequence === "transmit" && "Processing inputs"}
              {sequence === "saturate" && "Debating idea..."}
              {sequence === "flash" && "Synthesizing Brief..."}
              {sequence === "finalized" && "Dossier Compiled"}
            </span>
          </div>
        </div>
      </motion.div>

      {/* ─── AGENT PANELS ─── */}
      {AGENTS.map((agent, i) => {
        const awake = isAwake(i);
        const processing = isProcessing && awake;
        const style: React.CSSProperties = {
          position: "absolute",
          top: agent.top,
          width: 160,
          zIndex: 30,
          ...(agent.side === "left" ? { left: agent.left } : { right: agent.right }),
        };

        return (
          <motion.div
            key={agent.id}
            style={{
              ...style,
              transform: agent.side === "left" ? transCardsLeft : transCardsRight,
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: awake ? 1 : 0.45,
              y: awake ? 0 : 12,
            }}
            transition={{ duration: 0.5, delay: awake ? i * 0.08 : 0 }}
          >
            <div
              style={{
                background: awake ? "rgba(13, 14, 18, 0.8)" : "rgba(13, 14, 18, 0.5)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: 10,
                border: `1px solid ${processing ? agent.color + "40" : "rgba(255,255,255,0.06)"}`,
                padding: "10px 12px",
                boxShadow: processing ? `0 0 18px ${agent.color}10` : "0 8px 24px rgba(0,0,0,0.4)",
                transition: "border-color 0.4s, box-shadow 0.4s",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <agent.Icon size={12} color={awake ? agent.color : "#555"} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, letterSpacing: "0.06em", color: awake ? "#e4e4e7" : "#888" }}>
                    {agent.label}
                  </span>
                </div>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: awake ? agent.color : "#333", opacity: processing ? 1 : 0.4 }} />
              </div>

              {/* Micro-UI per agent */}
              <div style={{ height: 32, overflow: "hidden" }}>
                {renderAgentMicroUI(agent, sequence, processing, activeAgentIndex, verdictScore)}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/* ─── Micro UI components for each agent ─── */
function renderAgentMicroUI(
  agent: typeof AGENTS[number],
  sequence: Sequence,
  processing: boolean,
  activeAgentIndex: number,
  verdictScore: number,
) {
  switch (agent.id) {
    case "market":
      return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: "100%", background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: 3 }}>
          {[40, 70, 50, 95, 60, 45, 80].map((val, idx) => (
            <motion.div
              key={idx}
              animate={{
                height: processing ? [`${val / 2}%`, `${val}%`, `${val * 0.6}%`] : "20%",
              }}
              transition={{ repeat: Infinity, duration: 1.5 + idx * 0.2 }}
              style={{ flex: 1, background: `${agent.color}33`, borderRadius: 1 }}
            />
          ))}
        </div>
      );

    case "engineer":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "4px 6px", height: "100%", fontFamily: "var(--font-mono)", fontSize: 7, color: "rgba(34,211,238,0.7)", display: "flex", flexDirection: "column", justifyContent: "center", gap: 2, overflow: "hidden" }}>
          <p style={{ margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>&gt; GET /api/v1/schema_check</p>
          <motion.p
            animate={{ opacity: processing ? [0.5, 1, 0.5] : 0.5 }}
            transition={{ repeat: Infinity, duration: 2 }}
            style={{ margin: 0, color: "#34d399", whiteSpace: "nowrap" }}
          >
            ✔ PostGIS extension active
          </motion.p>
        </div>
      );

    case "product":
      return (
        <div style={{ display: "flex", gap: 6, alignItems: "center", height: "100%", paddingTop: 4 }}>
          {[1, 2, 3, 4].map((s, idx) => (
            <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <motion.div
                animate={{
                  backgroundColor: processing
                    ? ["rgba(96,165,250,0.1)", "rgba(96,165,250,0.7)", "rgba(96,165,250,0.1)"]
                    : "rgba(255,255,255,0.05)",
                }}
                transition={{ repeat: Infinity, duration: 2, delay: idx * 0.4 }}
                style={{ width: 6, height: 6, borderRadius: "50%" }}
              />
              <span style={{ fontSize: 6, fontFamily: "var(--font-mono)", color: "#555", marginTop: 3 }}>S{s}</span>
            </div>
          ))}
        </div>
      );

    case "vc":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: 4, height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <motion.span
              animate={{ color: processing ? ["#c084fc", "#e879f9", "#c084fc"] : "#c084fc" }}
              transition={{ repeat: Infinity, duration: 3 }}
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "block" }}
            >
              TAM: $1.2B
            </motion.span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "#555" }}>VIABLE SCALE MOAT</span>
          </div>
        </div>
      );

    case "growth":
      return (
        <div style={{ height: "100%", position: "relative", background: "rgba(0,0,0,0.3)", borderRadius: 4, overflow: "hidden" }}>
          <svg style={{ width: "100%", height: "100%", position: "absolute", left: 0, bottom: 0 }} viewBox="0 0 100 32">
            <motion.path
              animate={{ d: processing ? "M0,32 Q25,24 50,18 T100,4" : "M0,32 Q25,28 50,26 T100,24" }}
              fill="none"
              stroke={agent.color}
              strokeWidth="2"
              strokeOpacity="0.4"
            />
            <path d="M0,32 Q25,24 50,18 T100,4 L100,32 Z" fill={agent.color} opacity="0.06" />
          </svg>
        </div>
      );

    case "judge":
      return (
        <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "4px 6px", height: "100%" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "#555" }}>EVIDENCE</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "#fbbf24" }}>
              {sequence === "finalized" ? `${verdictScore}/100` : "—"}
            </span>
          </div>
          <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
            <motion.div
              animate={{
                width: sequence === "finalized" ? `${verdictScore}%` : sequence === "saturate" ? "65%" : "0%",
              }}
              style={{ height: "100%", background: "#fbbf24", borderRadius: 2, boxShadow: "0 0 6px #fbbf24" }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 3, marginTop: 3 }}>
            <Zap size={8} color="#ff5a2b" />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, color: "#555" }}>
              {sequence === "finalized" ? "GREENLIGHT" : "EVALUATING"}
            </span>
          </div>
        </div>
      );

    default:
      return null;
  }
}
