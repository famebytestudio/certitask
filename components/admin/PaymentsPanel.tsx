"use client";

import { useCallback, useEffect, useState } from "react";

interface Pay {
  id: string; plan: string | null; amountCents: number; currency: string; status: string; providerRef: string | null; providerState: string | null; receiptNumber: string | null; paidAt: string | null; refundedAt: string | null; refundReason: string | null; createdAt: string;
  client: { id: string; name: string; email: string; clientType: string | null };
  subscription: { id: string; status: string; periodEnd: string | null; postsUsed: number; postLimit: number | null } | null;
}
const usd = (c: number) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

/** Admin: every payment, revenue totals, manual refund marking (after refunding in Safepay), and re-check. */
export function PaymentsPanel() {
  const [rows, setRows] = useState<Pay[]>([]);
  const [totals, setTotals] = useState<{ revenueCents: number; paidCount: number; activeSubscriptions: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/admin/payments", { cache: "no-store" });
    if (r.ok) { const j = await r.json(); setRows(j.payments ?? []); setTotals(j.totals ?? null); }
    setLoading(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function act(p: Pay, action: "REFUND" | "RECHECK") {
    let reason: string | null = null;
    if (action === "REFUND") {
      reason = prompt(`Mark ${p.receiptNumber ?? p.id} as refunded?\n\nDo the actual refund in the Safepay dashboard first. Reason shown to the client:`);
      if (!reason) return;
    }
    setBusy(p.id); setMsg(null);
    const r = await fetch(`/api/admin/payments/${p.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    setMsg(r.ok ? (action === "REFUND" ? "Marked refunded; subscription ended." : `Re-checked: ${j.status}`) : (j.error ?? "Failed"));
    await load();
  }

  return (
    <div className="space-y-4">
      {totals && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[["Revenue (paid)", usd(totals.revenueCents)], ["Successful payments", String(totals.paidCount)], ["Active subscriptions", String(totals.activeSubscriptions)]].map(([l, v]) => (
            <div key={l} className="bg-white rounded-xl border border-gray-200 p-4"><div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{l}</div><div className="text-2xl font-extrabold text-navy mt-1">{v}</div></div>
          ))}
        </div>
      )}
      {msg && <div className="text-sm font-medium text-navy bg-blue-50 border border-blue-100 rounded-lg px-4 py-2">{msg}</div>}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
              <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Receipt / Ref</th><th className="px-5 py-3">Created</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">Loading…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={7} className="px-5 py-8 text-center text-gray-500">No payments yet.</td></tr>
              : rows.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3"><div className="font-medium text-navy">{p.client.name}</div><div className="text-xs text-gray-500">{p.client.email}</div></td>
                  <td className="px-5 py-3 text-gray-700">{p.plan ?? "—"}{p.subscription && <div className="text-xs text-gray-400">{p.subscription.status.toLowerCase()} · {p.subscription.postsUsed}{p.subscription.postLimit ? `/${p.subscription.postLimit}` : ""} posts · ends {fmt(p.subscription.periodEnd).split(",")[0]}</div>}</td>
                  <td className="px-5 py-3 font-semibold text-navy">{usd(p.amountCents)} {p.currency}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-[11px] font-bold ${p.status === "SUCCEEDED" ? "bg-green-100 text-green-700" : p.status === "REFUNDED" ? "bg-red-100 text-red-700" : p.status === "PENDING" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>{p.status}</span>{p.providerState && <div className="text-[10px] text-gray-400 mt-1">{p.providerState}</div>}{p.refundReason && <div className="text-xs text-red-700 mt-1">{p.refundReason}</div>}</td>
                  <td className="px-5 py-3 text-xs">{p.receiptNumber ? <a href={`/api/billing/receipt/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold">{p.receiptNumber}</a> : "—"}<div className="text-gray-400 font-mono truncate max-w-[180px]" title={p.providerRef ?? ""}>{p.providerRef ?? ""}</div></td>
                  <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{fmt(p.createdAt)}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap space-x-2">
                    {p.status === "PENDING" && <button disabled={busy === p.id} onClick={() => act(p, "RECHECK")} className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50">Re-check</button>}
                    {p.status === "SUCCEEDED" && <button disabled={busy === p.id} onClick={() => act(p, "REFUND")} className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50">Mark refunded</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
