"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Notice, SectionHeader, StatusBadge, daysUntil, formatDate } from "@/components/dashboard/ui";
import { api } from "@/components/dashboard/useDashboardData";
import { PlanCards, type PlanCatalogItem } from "@/components/billing/PlanCards";
import type { PlanTier } from "@/lib/plans";

interface Entitlement { verified: boolean; freePostsUsed: number; freePostsLeft: number; postsLeftInPeriod: number | null; canPost: boolean; reason: string; subscription: { id: string; plan: PlanTier; periodStart: string | null; periodEnd: string | null; postsUsed: number; postLimit: number | null; cancelledAt: string | null } | null }
interface Sub { id: string; plan: PlanTier; status: string; periodStart: string | null; periodEnd: string | null; postsUsed: number; postLimit: number | null; cancelledAt: string | null; createdAt: string }
interface Pay { id: string; plan: PlanTier | null; amountCents: number; currency: string; status: string; receiptNumber: string | null; paidAt: string | null; refundedAt: string | null; refundReason: string | null; createdAt: string }
interface Data { entitlement: Entitlement; subscriptions: Sub[]; payments: Pay[]; plans: PlanCatalogItem[]; freePosts: number; periodDays: number }

const usd = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

/** Start a hosted checkout for a plan and send the browser to Safepay. Shared with the plan-required modal. */
export async function goToCheckout(tier: PlanTier): Promise<string | null> {
  const r = await api<{ checkoutUrl: string }>("/api/billing/checkout", "POST", { plan: tier });
  if (!r.ok || !r.data?.checkoutUrl) return r.error ?? "Could not start checkout";
  window.location.assign(r.data.checkoutUrl);
  return null;
}

export function BillingTab({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  if (!data) return <p style={{ color: "var(--ink-muted)" }}>Loading…</p>;
  const e = data.entitlement;
  const sub = e.subscription;
  const planName = (t: PlanTier | null) => data.plans.find(p => p.tier === t)?.name ?? "—";

  async function choose(tier: PlanTier) {
    setBusy(tier); setError(null);
    const err = await goToCheckout(tier);
    if (err) { setError(err); setBusy(null); }
  }
  async function cancel() {
    if (!confirm("Stop renewal reminders? Your plan stays active until the period ends.")) return;
    const r = await api("/api/billing/cancel", "POST");
    if (!r.ok) { setError(r.error ?? "Failed"); return; }
    setInfo("Renewal reminders stopped. Your plan stays active until the period ends.");
    await load(); onChanged();
  }

  const daysLeft = sub?.periodEnd ? daysUntil(sub.periodEnd) : 0;

  return (
    <div>
      <SectionHeader icon="💳" title="Billing" subtitle={`Your first ${data.freePosts} published projects are free once verified. After that, pick a prepaid ${data.periodDays}-day plan. Prices in USD; Safepay settles PKR.`} />
      {error && <Notice kind="error">{error}</Notice>}
      {info && <Notice kind="success">{info}</Notice>}

      {/* Status card */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginBottom: 24, background: "#FAFAFA", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>Current plan</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", marginTop: 4 }}>{sub ? planName(sub.plan) : e.freePostsLeft > 0 ? "Free trial" : "No plan"}</div>
          {sub && <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""} left · ends {formatDate(sub.periodEnd)}{sub.cancelledAt ? " · reminders off" : ""}</div>}
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>Free posts</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", marginTop: 4 }}>{e.verified ? `${e.freePostsLeft} of ${data.freePosts}` : "—"}</div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>{e.verified ? "remaining, lifetime" : "unlock by verifying your account"}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>This period</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", marginTop: 4 }}>{sub ? (sub.postLimit === null ? `${sub.postsUsed} / ∞` : `${sub.postsUsed} / ${sub.postLimit}`) : "—"}</div>
          <div style={{ fontSize: 12, color: "var(--ink-muted)" }}>projects published</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: e.canPost ? "rgba(56,161,105,0.12)" : "rgba(229,62,62,0.12)", color: e.canPost ? "#276749" : "#9B2C2C" }}>
            {e.canPost ? "You can publish" : e.reason === "NOT_VERIFIED" ? "Verify to publish" : e.reason === "LIMIT_REACHED" ? "Limit reached" : "Plan required"}
          </span>
          {sub && !sub.cancelledAt && <Btn variant="ghost" small onClick={cancel}>Stop reminders</Btn>}
        </div>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", margin: "0 0 14px" }}>{sub ? "Upgrade or renew" : "Choose a plan"}</h3>
      {!e.verified && <Notice kind="warning">Plans can be bought once your account is verified.</Notice>}
      <div style={{ marginTop: 16, marginBottom: 32 }}>
        <PlanCards plans={data.plans} current={sub?.plan ?? null} onChoose={e.verified ? choose : undefined} busy={busy} compact />
      </div>
      {sub && <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: -20, marginBottom: 28 }}>Upgrading starts a new {data.periodDays}-day period today. To renew the same plan, choose it again in the last 7 days of the period or after it ends.</p>}

      <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", margin: "0 0 12px" }}>Payments</h3>
      {data.payments.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--ink-subtle)" }}>No payments yet.</p>
      ) : (
        <div className="tbl" style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 560 }}>
            <thead><tr style={{ background: "#F7FAFC", textAlign: "left" }}>
              {["Date", "Plan", "Amount", "Status", "Receipt"].map(h => <th key={h} style={{ padding: "10px 12px", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--ink-subtle)" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.payments.map(p => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 12px" }}>{formatDate(p.paidAt ?? p.createdAt)}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--navy)" }}>{planName(p.plan)}</td>
                  <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>{usd(p.amountCents)} {p.currency}</td>
                  <td style={{ padding: "10px 12px" }}><StatusBadge status={p.status === "SUCCEEDED" ? "VERIFIED" : p.status === "REFUNDED" ? "REVOKED" : "REJECTED"} label={p.status === "SUCCEEDED" ? "Paid" : p.status === "REFUNDED" ? "Refunded" : "Failed"} />{p.refundReason && <div style={{ fontSize: 11, color: "#9B2C2C", marginTop: 2 }}>{p.refundReason}</div>}</td>
                  <td style={{ padding: "10px 12px" }}>{p.receiptNumber ? <a href={`/api/billing/receipt/${p.id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: "var(--navy)" }}>{p.receiptNumber} ↗</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.subscriptions.length > 0 && (
        <>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--navy)", margin: "28px 0 12px" }}>Plan history</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--ink-muted)" }}>
            {data.subscriptions.map(s => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", flexWrap: "wrap" }}>
                <span><strong style={{ color: "var(--navy)" }}>{planName(s.plan)}</strong> · {formatDate(s.periodStart)} → {formatDate(s.periodEnd)}</span>
                <span>{s.postsUsed}{s.postLimit ? ` / ${s.postLimit}` : ""} posts · {s.status.toLowerCase()}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
