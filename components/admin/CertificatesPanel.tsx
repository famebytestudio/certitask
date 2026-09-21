"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Chips, EmptyState, Icon, LoadingRows, PageHeader, Pagination, Row, SearchInput, StatusBadge, Table, Td, Th, Toolbar, adminApi, fmtDate, useConfirm, useDebounced, useToast } from "./ui";

interface Cert { id: string; certId: string; title: string; recipientName: string; recipientEmail: string; issuerName: string; issuerType: string; status: string; statusReason: string | null; statusChangedAt: string | null; issuedAt: string; skills: string[]; talentId: string; clientId: string; projectId: string }
interface ListResp { certificates: Cert[]; total: number; page: number; pageSize: number }
export interface CertificatesQuery extends Record<string, string | undefined> { q?: string; status?: string; page?: string }

/** Admin view of every certificate with override actions (revoke / dispute / reinstate). */
export function CertificatesPanel({ query, setQuery, onChanged, openUser }: { query: CertificatesQuery; setQuery: (q: CertificatesQuery) => void; onChanged: () => void; openUser: (id: string) => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();
  const page = Number(query.page ?? 1);
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps
  // A search arriving from elsewhere (dashboard link, global search) replaces the box contents.
  useEffect(() => { const t = setTimeout(() => { if ((query.q ?? "") !== q && query.q !== dq) setQ(query.q ?? ""); }, 0); return () => clearTimeout(t); }, [query.q]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (dq) p.set("q", dq); if (query.status) p.set("status", query.status);
    const r = await adminApi<ListResp>(`/api/admin/certificates?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, dq, query.status]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function setStatus(c: Cert, status: "REVOKED" | "DISPUTED" | "VERIFIED") {
    const copy = status === "REVOKED" ? { title: `Revoke ${c.certId}?`, body: `${c.recipientName} loses this credential permanently; the public verify page shows it as revoked and they are emailed.`, tone: "danger" as const, label: "Revoke" }
      : status === "DISPUTED" ? { title: `Mark ${c.certId} as disputed?`, body: "It shows as under dispute until reinstated or revoked. The talent is emailed.", tone: "primary" as const, label: "Mark disputed" }
        : { title: `Reinstate ${c.certId}?`, body: "It verifies normally again and the talent is emailed.", tone: "primary" as const, label: "Reinstate" };
    const r = await confirm({ ...copy, confirmLabel: copy.label, reason: status === "VERIFIED" ? undefined : { label: "Reason (shown publicly on the verify page)", required: true } });
    if (!r.ok) return;
    setBusy(c.id);
    const res = await adminApi(`/api/certificates/${c.id}`, "PATCH", { status, reason: r.reason || undefined });
    setBusy(null);
    if (!res.ok) { toast("error", res.error ?? "Failed"); return; }
    toast("success", `${copy.label} done`); await load(); onChanged();
  }

  return (
    <div>
      <PageHeader title="Certificates" subtitle="Every credential the platform has issued. Overrides here are recorded in the audit log." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Certificate ID, recipient, issuer or project…" className="w-full sm:w-80" />
        <Chips value={query.status ?? ""} onChange={v => setQuery({ ...query, status: v || undefined, page: undefined })} options={[{ value: "", label: "All" }, { value: "VERIFIED", label: "Verified" }, { value: "DISPUTED", label: "Disputed" }, { value: "REVOKED", label: "Revoked" }]} />
      </Toolbar>
      <Table busy={loading} head={<><Th>Certificate</Th><Th>Recipient</Th><Th>Issuer</Th><Th>Issued</Th><Th>Status</Th><Th right>Actions</Th></>} minWidth={860}>
        {loading && !data ? <LoadingRows cols={6} /> : !data || data.certificates.length === 0 ? (
          <tr><td colSpan={6}><EmptyState icon="certificate" title="No certificates match" /></td></tr>
        ) : data.certificates.map(c => (
          <Row key={c.id}>
            <Td><Link href={`/certificates/${c.certId}`} target="_blank" className="font-semibold text-navy hover:underline">{c.title}</Link><div className="font-mono text-[11px] text-slate-400">{c.certId}</div></Td>
            <Td><button onClick={() => openUser(c.talentId)} className="text-sm font-medium text-navy hover:underline">{c.recipientName}</button><div className="text-xs text-slate-500">{c.recipientEmail}</div></Td>
            <Td><button onClick={() => openUser(c.clientId)} className="text-sm text-navy hover:underline">{c.issuerName}</button></Td>
            <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(c.issuedAt)}</Td>
            <Td><StatusBadge status={c.status} />{c.status !== "VERIFIED" && c.statusReason && <div className="mt-1 max-w-[200px] truncate text-[11px] text-red-700" title={c.statusReason}>{c.statusReason}</div>}</Td>
            <Td right>
              <div className="flex justify-end gap-1">
                <Link href={`/verify/${c.certId}`} target="_blank" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy" title="Verify"><Icon name="eye" className="h-4 w-4" /></Link>
                {c.status === "DISPUTED" && <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => setStatus(c, "VERIFIED")}>Reinstate</Button>}
                {c.status === "VERIFIED" && <Button size="sm" variant="secondary" loading={busy === c.id} onClick={() => setStatus(c, "DISPUTED")}>Dispute</Button>}
                {c.status !== "REVOKED" && <Button size="sm" variant="danger" loading={busy === c.id} onClick={() => setStatus(c, "REVOKED")}>Revoke</Button>}
              </div>
            </Td>
          </Row>
        ))}
      </Table>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} />}
      {data && data.total > 0 && <p className="mt-2 text-[11px] text-slate-400"><Badge tone="neutral">Tip</Badge> Revoking is permanent and cannot be undone; use “Dispute” while a complaint is being investigated.</p>}
    </div>
  );
}
