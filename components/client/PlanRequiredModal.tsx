"use client";

import { useEffect, useState } from "react";
import { Modal, Notice } from "@/components/dashboard/ui";
import { PlanCards, type PlanCatalogItem } from "@/components/billing/PlanCards";
import { goToCheckout } from "@/components/client/BillingTab";
import type { PlanTier } from "@/lib/plans";

/** Shown when publishing is blocked by billing (free posts used up / period limit reached). */
export function PlanRequiredModal({ reason, onClose }: { reason: "PLAN_REQUIRED" | "LIMIT_REACHED"; onClose: () => void }) {
  const [plans, setPlans] = useState<PlanCatalogItem[]>([]);
  const [current, setCurrent] = useState<PlanTier | null>(null);
  const [freePosts, setFreePosts] = useState(2);
  const [busy, setBusy] = useState<PlanTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/billing", { cache: "no-store" }).then(r => r.json()).then(d => { if (!live) return; setPlans(d.plans ?? []); setCurrent(d.entitlement?.subscription?.plan ?? null); setFreePosts(d.freePosts ?? 2); }).catch(() => {});
    return () => { live = false; };
  }, []);

  async function choose(tier: PlanTier) {
    setBusy(tier); setError(null);
    const err = await goToCheckout(tier);
    if (err) { setError(err); setBusy(null); }
  }

  return (
    <Modal
      title={reason === "LIMIT_REACHED" ? "This period's posts are used up" : "Choose a plan to keep posting"}
      subtitle={reason === "LIMIT_REACHED" ? "Upgrade to a bigger plan — a new 30-day period starts today." : `You've used your ${freePosts} free project posts. Your project is saved as a draft; pick a plan and it can go live right after payment.`}
      onClose={onClose}
      maxWidth={860}
    >
      {plans.length === 0 ? <p style={{ color: "var(--ink-muted)" }}>Loading plans…</p> : <PlanCards plans={plans} current={current} onChoose={choose} busy={busy} compact />}
      {error && <Notice kind="error">{error}</Notice>}
      <p style={{ fontSize: 12, color: "var(--ink-subtle)", marginTop: 14 }}>Secure checkout by Safepay · prices in USD · no auto-renewal.</p>
    </Modal>
  );
}
