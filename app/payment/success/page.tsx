"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type State = { kind: "checking" } | { kind: "ok" } | { kind: "pending"; tries: number } | { kind: "error"; message: string };

function Success() {
  const params = useSearchParams();
  const router = useRouter();
  const paymentId = params.get("order_id") ?? params.get("payment"); // Safepay sends order_id (= our payment id)
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    if (!paymentId) return;
    let cancelled = false;
    let tries = 0;
    async function check() {
      tries++;
      try {
        const res = await fetch("/api/billing/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) });
        const json = await res.json();
        if (cancelled) return;
        if (res.status === 401) { router.replace(`/auth/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; } // session expired during checkout
        if (res.ok && json.status === "SUCCEEDED") { setState({ kind: "ok" }); return; }
        if (!res.ok && res.status !== 502) { setState({ kind: "error", message: json.error ?? "Could not confirm the payment." }); return; }
        // Provider hasn't marked it paid yet — poll a few times.
        if (tries < 8) { setState({ kind: "pending", tries }); setTimeout(check, 3000); }
        else setState({ kind: "error", message: "We could not confirm the payment yet. If you were charged, your plan will activate automatically within a few minutes — check the Billing tab." });
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Network error. Open the Billing tab to check your plan." });
      }
    }
    void check();
    return () => { cancelled = true; };
  }, [paymentId, router]);

  const icon = state.kind === "ok" ? "✅" : state.kind === "error" ? "⚠️" : "⏳";
  const title = state.kind === "ok" ? "Payment confirmed" : state.kind === "error" ? "Not confirmed yet" : "Confirming your payment…";
  const body = !paymentId ? "This page needs a payment reference." : state.kind === "ok" ? "Your plan is active. You can publish projects right away." : state.kind === "error" ? state.message : "We're checking with Safepay. This usually takes a few seconds.";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", padding: 20 }}>
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 36, maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "var(--shadow-md)" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: "0 0 8px" }}>{title}</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, margin: "0 0 20px" }}>{body}</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/client/dashboard?tab=post-project" style={{ display: "inline-block", padding: "10px 22px", background: "var(--navy)", color: "#fff", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Post a project</Link>
          <Link href="/client/dashboard?tab=billing" style={{ display: "inline-block", padding: "10px 22px", border: "1px solid var(--border)", color: "var(--navy)", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Billing</Link>
        </div>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return <Suspense fallback={null}><Success /></Suspense>;
}
