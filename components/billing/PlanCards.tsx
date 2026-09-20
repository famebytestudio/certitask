"use client";

import type { PlanTier } from "@/lib/plans";

export interface PlanCatalogItem {
  tier: PlanTier; name: string; tagline: string; price: string; priceCents: number; postLimit: number | null; perks: string[];
}

/**
 * Plan comparison cards, used by /pricing and the in-dashboard picker.
 * `current` marks the active plan; `onChoose` (when given) turns cards into buttons.
 */
export function PlanCards({ plans, current, onChoose, busy, compact }: {
  plans: PlanCatalogItem[]; current?: PlanTier | null; onChoose?: (tier: PlanTier) => void; busy?: PlanTier | null; compact?: boolean;
}) {
  const rank: Record<PlanTier, number> = { STARTER: 1, GROWTH: 2, PRO: 3 };
  return (
    <div className="mobile-dashboard-form-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${plans.length}, 1fr)`, gap: compact ? 12 : 20 }}>
      {plans.map(p => {
        const isCurrent = current === p.tier;
        const lower = current ? rank[p.tier] < rank[current] : false;
        const highlight = p.tier === "GROWTH";
        return (
          <div key={p.tier} style={{ border: `2px solid ${isCurrent ? "var(--success)" : highlight ? "var(--gold)" : "var(--border)"}`, borderRadius: 16, padding: compact ? 18 : 24, background: highlight ? "#FFFDF5" : "#fff", position: "relative", display: "flex", flexDirection: "column" }}>
            {highlight && !isCurrent && <span style={{ position: "absolute", top: -11, left: 18, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", background: "var(--gold)", color: "var(--navy)", padding: "3px 10px", borderRadius: 10 }}>Most popular</span>}
            {isCurrent && <span style={{ position: "absolute", top: -11, left: 18, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", background: "var(--success)", color: "#fff", padding: "3px 10px", borderRadius: 10 }}>Your plan</span>}
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>{p.name}</div>
            <div style={{ fontSize: compact ? 28 : 36, fontWeight: 800, color: "var(--navy)", margin: "6px 0 0", lineHeight: 1 }}>{p.price}<span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-subtle)" }}> / 30 days</span></div>
            <div style={{ fontSize: 12, color: "var(--ink-muted)", margin: "6px 0 14px" }}>{p.tagline}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", marginBottom: 10 }}>{p.postLimit === null ? "Unlimited" : p.postLimit} project post{p.postLimit === 1 ? "" : "s"}</div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              {p.perks.map(k => <li key={k} style={{ fontSize: 13, color: "var(--ink-muted)", display: "flex", gap: 8 }}><span style={{ color: "var(--success)", fontWeight: 800 }}>✓</span>{k}</li>)}
            </ul>
            {onChoose && (
              <button onClick={() => onChoose(p.tier)} disabled={!!busy || isCurrent || lower}
                style={{ padding: "11px 0", borderRadius: 10, border: "none", fontWeight: 800, fontSize: 14, cursor: busy || isCurrent || lower ? "not-allowed" : "pointer", background: isCurrent ? "#EDF2F7" : highlight ? "var(--gold)" : "var(--navy)", color: isCurrent ? "var(--ink-subtle)" : highlight ? "var(--navy)" : "#fff", opacity: busy && busy !== p.tier ? 0.6 : 1 }}>
                {busy === p.tier ? "Opening checkout…" : isCurrent ? "Current plan" : lower ? "Available after current period" : current ? `Upgrade to ${p.name}` : `Choose ${p.name}`}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
