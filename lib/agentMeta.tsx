import type { ReactNode } from "react";
import { Briefcase, ClipboardList, Code2, Palette, Rocket, ShieldAlert, UserRound } from "lucide-react";

export type AgentMeta = {
  label: string;
  color: string;
  icon: ReactNode;
  isDevil?: boolean;
};

const iconProps = { size: 14, strokeWidth: 2 };

export const agentMetaMap: Record<string, AgentMeta> = {
  vc:          { label: "VC Investor",      color: "#7c3aed", icon: <Briefcase {...iconProps} /> },
  engineer:    { label: "Senior Engineer",  color: "#2563eb", icon: <Code2 {...iconProps} /> },
  indiehacker: { label: "Indie Hacker",     color: "#059669", icon: <Rocket {...iconProps} /> },
  pm:          { label: "Product Manager",  color: "#d97706", icon: <ClipboardList {...iconProps} /> },
  ux:          { label: "UX Designer",      color: "#dc2626", icon: <Palette {...iconProps} /> },
  user:        { label: "Skeptical User",   color: "#0891b2", icon: <UserRound {...iconProps} /> },
  devil:       { label: "Devil's Advocate", color: "#be123c", icon: <ShieldAlert {...iconProps} />, isDevil: true },
};

export const agentOrder = ["vc", "engineer", "indiehacker", "pm", "ux", "user", "devil"];
