"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, EmptyState, LoadingRows, PageHeader, Pagination, Row, SearchInput, Select, StatCard, StatusBadge, Table, Td, Th, Toolbar, adminApi, fmtDate, fmtDateTime, humanize, useConfirm, useDebounced, useToast, usd } from "./ui";

interface Pay {
  id: string; plan: string | null; amountCents: number; currency: string; status: string; providerRef: string | null; providerState: string | null; receiptNumber: string | null; paidAt: string | null; refundedAt: string | null; refundReason: string | null; createdAt: string;
  client: { id: string; name: string; email: string; clientType: string | null };
  subscription: { id: string; status: string; periodEnd: string | null; postsUsed: number; postLimit: number | null } | null;
}
interface ListResp { payments: Pay[]; total: number; page: number; pageSize: number; totals: { revenueCents: number; paidCount: number; activeSubscriptions: number } }
export interface PaymentsQuery extends Record<string, string | undefined> { q?: string; status?: string; page?: string }

/** Admin: payments with totals, search/filter, CSV export, manual refund marking and re-check. */
export function PaymentsPanel({ query, setQuery, onChanged, openUser }: { query: PaymentsQuery; setQuery: (q: PaymentsQuery) => void; onChanged: () => void; openUser: (id: string) => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();
  const page = Number(query.page ?? 1);
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (dq) p.set("q", dq); if (query.status) p.set("status", query.status);
    const r = await adminApi<ListResp>(`/api/admin/payments?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, dq, query.status]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function act(p: Pay, action: "REFUND" | "RECHECK") {
    let reason: string | undefined;
    if (action === "REFUND") {
      const r = await confirm({ title: `Mark ${p.receiptNumber ?? "this payment"} as refunded?`, body: <>Do the actual refund in the <strong>Safepay dashboard first</strong> — this only records it and ends the client&apos;s plan.</>, confirmLabel: "Mark refunded", tone: "danger", reason: { label: "Reason (shown to the client)", required: true } });
      if (!r.ok) return; reason = r.reason;
    }
    setBusy(p.id);
    const r = await adminApi<{ status?: string }>(`/api/admin/payments/${p.id}`, "PATCH", { action, reason });
    setBusy(null);
    if (!r.ok) { toast("error", r.error ?? "Failed"); return; }
    toast("success", action === "REFUND" ? "Marked refunded; subscription ended" : `Re-checked with Safepay: ${humanize(r.data?.status ?? "unknown")}`);
    await load(); onChanged();
  }

  return (
    <div>
      <PageHeader title="Payments" subtitle="Plan purchases via Safepay. Amounts in USD; Safepay settles PKR." actions={<Button variant="secondary" icon="download" onClick={() => window.open("/api/admin/payments?format=csv", "_blank")}>Export CSV</Button>} />
      {data && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Revenue (paid)" value={usd(data.totals.revenueCents)} tone="success" />
          <StatCard label="Successful payments" value={data.totals.paidCount} tone="navy" />
          <StatCard label="Active plans" value={data.totals.activeSubscriptions} tone="gold" />
        </div>
      )}
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Receipt, client or Safepay ref…" className="w-full sm:w-72" />
        <Select aria-label="Status" value={query.status ?? ""} onChange={v => setQuery({ ...query, status: v || undefined, page: undefined })} options={[{ value: "", label: "All except cancelled" }, { value: "SUCCEEDED", label: "Paid" }, { value: "PENDING", label: "Pending" }, { value: "FAILED", label: "Failed" }, { value: "REFUNDED", label: "Refunded" }, { value: "CANCELLED", label: "Cancelled" }]} />
      </Toolbar>
      <Table busy={loading} head={<><Th>Client</Th><Th>Plan</Th><Th>Amount</Th><Th>Status</Th><Th>Receipt / ref</Th><Th>Created</Th><Th right>Actions</Th></>} minWidth={900}>
        {loading && !data ? <LoadingRows cols={7} /> : !data || data.payments.length === 0 ? (
          <tr><td colSpan={7}><EmptyState icon="card" title="No payments match" /></td></tr>
        ) : data.payments.map(p => (
          <Row key={p.id}>
            <Td><button onClick={() => openUser(p.client.id)} className="font-semibold text-navy hover:underline">{p.client.name}</button><div className="text-xs text-slate-500">{p.client.email}</div></Td>
            <Td>{p.plan ? <Badge tone="gold">{humanize(p.plan)}</Badge> : "—"}{p.subscription && <div className="mt-1 text-[11px] text-slate-400">{p.subscription.status.toLowerCase()} · {p.subscription.postsUsed}{p.subscription.postLimit ? `/${p.subscription.postLimit}` : ""} posts · ends {fmtDate(p.subscription.periodEnd)}</div>}</Td>
            <Td className="font-semibold tabular-nums text-navy">{usd(p.amountCents)} <span className="text-xs font-normal text-slate-400">{p.currency}</span></Td>
            <Td><StatusBadge status={p.status} />{p.providerState && <div className="mt-1 max-w-[180px] truncate text-[10px] text-slate-400" title={p.providerState}>{p.providerState}</div>}{p.refundReason && <div className="mt-1 text-[11px] text-red-700">{p.refundReason}</div>}</Td>
            <Td className="text-xs">{p.receiptNumber ? <a href={`/api/billing/receipt/${p.id}`} target="_blank" rel="noopener noreferrer" className="font-mono font-semibold text-sky-700 hover:underline">{p.receiptNumber}</a> : "—"}<div className="max-w-[160px] truncate font-mono text-[10px] text-slate-400" title={p.providerRef ?? ""}>{p.providerRef ?? ""}</div></Td>
            <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(p.createdAt)}</Td>
            <Td right>
              <div className="flex justify-end gap-1">
                {p.status === "PENDING" && <Button size="sm" variant="secondary" icon="refresh" loading={busy === p.id} onClick={() => act(p, "RECHECK")}>Re-check</Button>}
                {p.status === "SUCCEEDED" && <Button size="sm" variant="secondary" className="text-red-700 ring-red-300 hover:bg-red-50" loading={busy === p.id} onClick={() => act(p, "REFUND")}>Mark refunded</Button>}
              </div>
            </Td>
          </Row>
        ))}
      </Table>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} />}
    </div>
  );
}
