"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, EmptyState, LoadingRows, PageHeader, Pagination, Row, SearchInput, Select, Table, Td, Th, Toolbar, adminApi, fmtDateTime, useDebounced } from "./ui";

interface Entry { id: string; action: string; label: string; actorRole: string; actorId: string | null; actor: { name: string; email?: string }; entityType: string; entityId: string; metadata: Record<string, unknown> | null; createdAt: string }
interface ListResp { entries: Entry[]; total: number; page: number; pageSize: number; actions: string[] }
export interface AuditQuery extends Record<string, string | undefined> { q?: string; action?: string; role?: string; entity?: string; page?: string }

const GROUPS = [["", "All actions"], ["user", "Accounts"], ["verification", "Verification"], ["project", "Projects"], ["application", "Applications"], ["submission", "Submissions"], ["certificate", "Certificates"], ["billing", "Billing"], ["message", "Messages"]] as const;

/** Read-only audit log: who did what, when, with the recorded details. */
export function AuditPanel({ query, setQuery, openUser }: { query: AuditQuery; setQuery: (q: AuditQuery) => void; openUser: (id: string) => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const page = Number(query.page ?? 1);
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (dq) p.set("q", dq); if (query.action) p.set("action", query.action); if (query.role) p.set("role", query.role); if (query.entity) p.set("entity", query.entity);
    const r = await adminApi<ListResp>(`/api/admin/audit?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, dq, query.action, query.role, query.entity]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  const detail = (m: Record<string, unknown> | null) => {
    if (!m) return null;
    const parts: string[] = [];
    for (const k of ["title", "reason", "from", "to", "plan", "certId", "email", "count", "fields"]) {
      const v = m[k];
      if (v === undefined || v === null) continue;
      parts.push(`${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`);
    }
    return parts.length ? parts.join(" · ") : null;
  };

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every consequential action on the platform, by admins, users and the system." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Entity or actor id, action…" className="w-full sm:w-72" />
        <Select aria-label="Action group" value={query.action ?? ""} onChange={v => setQuery({ ...query, action: v || undefined, page: undefined })} options={GROUPS.map(([value, label]) => ({ value, label }))} />
        <Select aria-label="Actor" value={query.role ?? ""} onChange={v => setQuery({ ...query, role: v || undefined, page: undefined })} options={[{ value: "", label: "Any actor" }, { value: "ADMIN", label: "Admin" }, { value: "CLIENT", label: "Clients" }, { value: "TALENT", label: "Talent" }, { value: "SYSTEM", label: "System" }]} />
      </Toolbar>
      <Table busy={loading} head={<><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Details</Th></>} minWidth={880}>
        {loading && !data ? <LoadingRows cols={5} rows={8} /> : !data || data.entries.length === 0 ? (
          <tr><td colSpan={5}><EmptyState icon="list" title="No entries match" /></td></tr>
        ) : data.entries.map(e => (
          <Row key={e.id}>
            <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(e.createdAt)}</Td>
            <Td>
              {e.actorId && e.actorRole !== "ADMIN" && e.actorRole !== "SYSTEM" ? <button onClick={() => openUser(e.actorId!)} className="text-sm font-semibold text-navy hover:underline">{e.actor.name}</button> : <span className="text-sm font-semibold text-navy">{e.actor.name}</span>}
              <div><Badge tone={e.actorRole === "ADMIN" ? "gold" : e.actorRole === "SYSTEM" ? "neutral" : e.actorRole === "CLIENT" ? "navy" : "success"}>{e.actorRole.toLowerCase()}</Badge></div>
            </Td>
            <Td><div className="text-sm text-navy">{e.label}</div><div className="font-mono text-[10px] text-slate-400">{e.action}</div></Td>
            <Td>
              <div className="text-xs text-slate-600">{e.entityType}</div>
              {e.entityType === "user" ? <button onClick={() => openUser(e.entityId)} className="font-mono text-[11px] text-sky-700 hover:underline">{e.entityId.slice(0, 8)}…</button> : <span className="font-mono text-[11px] text-slate-400">{e.entityId.slice(0, 8)}…</span>}
            </Td>
            <Td className="max-w-md text-xs text-slate-600"><span className="line-clamp-2" title={detail(e.metadata) ?? undefined}>{detail(e.metadata) ?? "—"}</span></Td>
          </Row>
        ))}
      </Table>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} />}
    </div>
  );
}
