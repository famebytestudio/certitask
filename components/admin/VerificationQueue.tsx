"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Chips, EmptyState, KeyValue, LoadingRows, PageHeader, Row, SearchInput, Select, StatusBadge, Table, Td, Th, Toolbar, adminApi, fmtDateTime, useConfirm, useDebounced, useToast } from "./ui";

interface Doc { id: string; type: string; mimeType: string; sizeBytes: number; createdAt: string }
interface Req {
  id: string; kind: "IDENTITY" | "ORGANIZATION"; status: string; submittedAt: string; reviewedAt: string | null; reviewedBy: string | null; rejectionReason: string | null;
  formData: { legalName?: string; idType?: string; idLast4?: string; authorizedPersonName?: string; registrationNumber?: string } | null;
  user: { id: string; name: string; email: string; role: string; clientType: string | null; website: string | null; location: string | null; createdAt: string; emailVerifiedAt: string | null };
  documents: Doc[];
}
export interface VerificationsQuery extends Record<string, string | undefined> { status?: string; kind?: string; q?: string; request?: string }

const DOC_LABEL: Record<string, string> = { ID_FRONT: "ID front", ID_BACK: "ID back", ORG_REGISTRATION: "Registration document", OTHER: "Other" };

/** Admin review queue for identity / organization verification. */
export function VerificationQueue({ query, setQuery, onDecided, openUser }: { query: VerificationsQuery; setQuery: (q: VerificationsQuery) => void; onDecided: () => void; openUser: (id: string) => void }) {
  const filter = query.status ?? "PENDING_REVIEW";
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();
  const { toast } = useToast();
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ status: filter });
    if (query.kind) p.set("kind", query.kind); if (dq) p.set("q", dq);
    const r = await adminApi<{ requests: Req[] }>(`/api/admin/verifications?${p}`);
    if (r.ok && r.data) setRequests(r.data.requests ?? []);
    setLoading(false);
  }, [filter, query.kind, dq]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  const open = requests.find(r => r.id === query.request) ?? null;

  async function decide(decision: "APPROVE" | "REJECT") {
    if (!open) return;
    const r = decision === "APPROVE"
      ? await confirm({ title: `Approve ${open.user.name}?`, body: <>Their legal name becomes <strong>{open.formData?.legalName}</strong>, the Verified badge appears on their profile and any held certificates are issued.</>, confirmLabel: "Approve" })
      : await confirm({ title: `Reject ${open.user.name}'s request?`, body: "They are emailed the reason and can resubmit.", confirmLabel: "Reject", tone: "danger", reason: { label: "Reason (sent to the applicant)", required: true, placeholder: "e.g. The name on the ID does not match the legal name typed." } });
    if (!r.ok) return;
    setBusy(true);
    const res = await adminApi(`/api/admin/verifications/${open.id}`, "PATCH", { decision, reason: r.reason });
    setBusy(false);
    if (!res.ok) { toast("error", res.error ?? "Failed"); return; }
    toast("success", decision === "APPROVE" ? `${open.user.name} is now verified` : "Request rejected");
    setQuery({ ...query, request: undefined });
    await load(); onDecided();
  }

  return (
    <div>
      <PageHeader title="Verifications" subtitle="Identity and organization checks. Approving sets the legal name that is printed on certificates." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search applicant…" className="w-full sm:w-64" />
        <Chips value={filter} onChange={v => setQuery({ ...query, status: v === "PENDING_REVIEW" ? undefined : v, request: undefined })} options={[{ value: "PENDING_REVIEW", label: "Pending" }, { value: "VERIFIED", label: "Approved" }, { value: "REJECTED", label: "Rejected" }, { value: "ALL", label: "All" }]} />
        <Select aria-label="Kind" value={query.kind ?? ""} onChange={v => setQuery({ ...query, kind: v || undefined })} options={[{ value: "", label: "Identity & organization" }, { value: "IDENTITY", label: "Identity only" }, { value: "ORGANIZATION", label: "Organization only" }]} />
      </Toolbar>

      <div className={`grid grid-cols-1 gap-4 ${open ? "xl:grid-cols-5" : ""}`}>
        <div className={open ? "xl:col-span-2" : ""}>
          <Table busy={loading} head={<><Th>Applicant</Th><Th>Kind</Th><Th>Submitted</Th><Th right>Status</Th></>} minWidth={520}>
            {loading && requests.length === 0 ? <LoadingRows cols={4} /> : requests.length === 0 ? (
              <tr><td colSpan={4}><EmptyState icon="idcard" title={filter === "PENDING_REVIEW" ? "Queue is empty" : "Nothing here"} hint={filter === "PENDING_REVIEW" ? "New submissions appear here the moment a user uploads their documents." : undefined} /></td></tr>
            ) : requests.map(r => (
              <Row key={r.id} onClick={() => setQuery({ ...query, request: r.id })} active={open?.id === r.id}>
                <Td><div className="font-semibold text-navy">{r.user.name}</div><div className="text-xs text-slate-500">{r.user.email} · {r.user.role === "CLIENT" ? `client (${r.user.clientType === "ORGANIZATION" ? "org" : "individual"})` : "talent"}</div></Td>
                <Td className="text-sm text-slate-600">{r.kind === "ORGANIZATION" ? "Organization" : "Identity"}<div className="text-xs text-slate-400">{r.formData?.idType} ···{r.formData?.idLast4}</div></Td>
                <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDateTime(r.submittedAt)}</Td>
                <Td right><StatusBadge status={r.status} /></Td>
              </Row>
            ))}
          </Table>
        </div>

        {open && (
          <div className="xl:col-span-3">
            <div className="rounded-xl bg-white ring-1 ring-slate-200/80">
              <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-base font-extrabold text-navy">{open.kind === "ORGANIZATION" ? "Organization verification" : "Identity verification"} · {open.user.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{open.user.email} · account created {fmtDateTime(open.user.createdAt)} · email {open.user.emailVerifiedAt ? "confirmed" : <span className="font-bold text-red-700">NOT confirmed</span>}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" icon="user" onClick={() => openUser(open.user.id)}>Account</Button>
                  <Button variant="ghost" size="sm" icon="x" onClick={() => setQuery({ ...query, request: undefined })} aria-label="Close" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 px-5 py-4 lg:grid-cols-3">
                <div className="space-y-4 text-sm lg:col-span-1">
                  <div>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">What they typed</div>
                    <KeyValue items={[
                      [open.kind === "ORGANIZATION" ? "Organization legal name" : "Legal name", <strong key="ln" className="text-navy">{open.formData?.legalName}</strong>],
                      ...(open.kind === "ORGANIZATION" ? [["Registration no.", open.formData?.registrationNumber], ["Authorized person", open.formData?.authorizedPersonName]] as Array<[string, React.ReactNode]> : []),
                      ["ID type", open.formData?.idType], ["ID ends with", open.formData?.idLast4 ? `···${open.formData.idLast4}` : null],
                    ]} />
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Profile</div>
                    <KeyValue items={[["Display name", open.user.name], ["Website", open.user.website], ["Location", open.user.location]]} />
                  </div>
                  {open.status !== "PENDING_REVIEW" && (
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Decision</div>
                      <KeyValue items={[["Status", <StatusBadge key="s" status={open.status} />], ["Reviewed", fmtDateTime(open.reviewedAt)], ["Reason", open.rejectionReason]]} />
                    </div>
                  )}
                  <div className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 ring-1 ring-amber-200">
                    <strong>Check:</strong> the name on the document matches the typed legal name exactly; the ID number ends with the digits shown; the document is legible, not expired, all corners visible{open.kind === "ORGANIZATION" ? "; the registration number matches the certificate" : ""}.
                  </div>
                </div>
                <div className="space-y-3 lg:col-span-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Documents <Badge>{open.documents.length}</Badge></div>
                  {open.documents.length === 0 && <p className="text-sm text-slate-500">No documents (purged or missing).</p>}
                  {open.documents.map(d => (
                    <div key={d.id} className="overflow-hidden rounded-lg ring-1 ring-slate-200">
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2 text-xs">
                        <span className="font-bold text-navy">{DOC_LABEL[d.type] ?? d.type}</span>
                        <span className="text-slate-500">{d.sizeBytes < 1024 ? "<1" : Math.round(d.sizeBytes / 1024)} KB · <a href={`/api/verification/documents/${d.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-sky-700 hover:underline">open in new tab ↗</a></span>
                      </div>
                      {d.mimeType === "application/pdf"
                        ? <iframe src={`/api/verification/documents/${d.id}`} title={DOC_LABEL[d.type]} className="h-[420px] w-full bg-white" />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={`/api/verification/documents/${d.id}`} alt={DOC_LABEL[d.type]} className="max-h-[420px] w-full bg-slate-100 object-contain" />}
                    </div>
                  ))}
                </div>
              </div>
              {open.status === "PENDING_REVIEW" && (
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
                  <Button variant="secondary" className="text-red-700 ring-red-300 hover:bg-red-50" loading={busy} onClick={() => decide("REJECT")}>Reject…</Button>
                  <Button variant="primary" icon="check" loading={busy} onClick={() => decide("APPROVE")}>Approve</Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
