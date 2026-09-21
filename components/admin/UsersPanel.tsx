"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Avatar, Badge, Button, Chips, Drawer, EmptyState, Icon, KeyValue, LoadingRows, PageHeader, Pagination, Row, SearchInput, Section, Select, StatusBadge, Table, Td, Th, Toolbar, adminApi, fmtDate, fmtDateTime, humanize, relTime, useConfirm, useDebounced, useToast, usd } from "./ui";
import { CLIENT_TYPE_LABEL } from "@/lib/enums";

interface UserRow {
  id: string; name: string; email: string; role: "CLIENT" | "TALENT"; clientType: "INDIVIDUAL" | "ORGANIZATION" | null; verificationStatus: string; emailVerifiedAt: string | null; suspendedAt: string | null; createdAt: string; location: string | null; universityName: string | null; plan: string | null;
  _count: { projectsPosted: number; certificatesIssued: number; teamMemberships: number; certificatesEarned: number };
}
interface ListResp { users: UserRow[]; total: number; page: number; pageSize: number }

export interface UsersQuery extends Record<string, string | undefined> { role?: string; verified?: string; suspended?: string; q?: string; page?: string; user?: string }

export function UsersPanel({ query, setQuery, onChanged }: { query: UsersQuery; setQuery: (q: UsersQuery) => void; onChanged: () => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const role = query.role ?? "";
  const verified = query.verified ?? "";
  const suspended = query.suspended ?? "";
  const page = Number(query.page ?? 1);

  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (dq) p.set("q", dq); if (role) p.set("role", role); if (verified) p.set("verified", verified); if (suspended) p.set("suspended", suspended);
    const r = await adminApi<ListResp>(`/api/admin/users?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, dq, role, verified, suspended]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  const open = (id: string) => setQuery({ ...query, user: id });

  return (
    <div>
      <PageHeader title="Users" subtitle="Every client and talent account. Click a row for the full picture." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search name, email or legal name…" className="w-full sm:w-72" />
        <Chips value={role} onChange={v => setQuery({ ...query, role: v || undefined, page: undefined })} options={[{ value: "", label: "All" }, { value: "CLIENT", label: "Clients" }, { value: "TALENT", label: "Talent" }]} />
        <Select aria-label="Verification" value={verified} onChange={v => setQuery({ ...query, verified: v || undefined, page: undefined })} options={[{ value: "", label: "Any verification" }, { value: "VERIFIED", label: "Verified" }, { value: "PENDING_REVIEW", label: "Pending review" }, { value: "UNVERIFIED", label: "Not verified" }, { value: "REJECTED", label: "Rejected" }]} />
        <Select aria-label="Account state" value={suspended} onChange={v => setQuery({ ...query, suspended: v || undefined, page: undefined })} options={[{ value: "", label: "Any state" }, { value: "0", label: "Active" }, { value: "1", label: "Suspended" }]} />
      </Toolbar>

      <Table busy={loading} head={<><Th>Account</Th><Th>Role</Th><Th>Verification</Th><Th>Activity</Th><Th>Plan</Th><Th>Joined</Th><Th right>State</Th></>}>
        {loading && !data ? <LoadingRows cols={7} /> : !data || data.users.length === 0 ? (
          <tr><td colSpan={7}><EmptyState icon="users" title="No accounts match" hint="Try a different search or clear the filters." /></td></tr>
        ) : data.users.map(u => (
          <Row key={u.id} onClick={() => open(u.id)} active={query.user === u.id}>
            <Td>
              <div className="flex items-center gap-3">
                <Avatar name={u.name} role={u.role} />
                <div className="min-w-0"><div className="truncate font-semibold text-navy">{u.name}</div><div className="truncate text-xs text-slate-500">{u.email}</div></div>
              </div>
            </Td>
            <Td><div className="flex flex-wrap gap-1"><Badge tone={u.role === "CLIENT" ? "navy" : "success"}>{u.role === "CLIENT" ? "Client" : "Talent"}</Badge>{u.clientType && <Badge>{CLIENT_TYPE_LABEL[u.clientType]}</Badge>}</div></Td>
            <Td><div className="flex flex-wrap gap-1"><StatusBadge status={u.verificationStatus} />{!u.emailVerifiedAt && <Badge tone="warning">Email unconfirmed</Badge>}</div></Td>
            <Td className="text-xs text-slate-600">{u.role === "CLIENT" ? `${u._count.projectsPosted} projects · ${u._count.certificatesIssued} certs issued` : `${u._count.teamMemberships} teams · ${u._count.certificatesEarned} certs`}</Td>
            <Td>{u.plan ? <Badge tone="gold">{humanize(u.plan)}</Badge> : u.role === "CLIENT" ? <span className="text-xs text-slate-400">Free</span> : <span className="text-xs text-slate-300">—</span>}</Td>
            <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(u.createdAt)}</Td>
            <Td right>{u.suspendedAt ? <Badge tone="danger" dot>Suspended</Badge> : <Badge tone="success" dot>Active</Badge>}</Td>
          </Row>
        ))}
      </Table>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} />}

      <UserDrawer id={query.user ?? null} onClose={() => setQuery({ ...query, user: undefined })} onChanged={() => { void load(); onChanged(); }} />
    </div>
  );
}

/* ─────────────────────────── detail drawer ─────────────────────────── */

interface Detail {
  user: {
    id: string; name: string; email: string; role: "CLIENT" | "TALENT"; clientType: string | null; legalName: string | null; verificationStatus: string; verifiedAt: string | null; emailVerifiedAt: string | null; suspendedAt: string | null; createdAt: string; updatedAt: string; avatarUrl: string | null; bio: string | null; website: string | null; location: string | null; industry: string | null; organizationSize: string | null; universityName: string | null; degreeProgram: string | null; skills: string[]; portfolioUrl: string | null; linkedinUrl: string | null; idType: string | null; idLast4: string | null; freePostsUsed: number;
    projectsPosted: Array<{ id: string; title: string; status: string; createdAt: string; featured: boolean; _count: { applications: number; submissions: number; certificates: number } }>;
    teamMemberships: Array<{ role: string; status: string; team: { id: string; name: string; project: { id: string; title: string; status: string } } }>;
    certificatesEarned: Array<{ id: string; certId: string; title: string; status: string; issuedAt: string; issuerName: string }>;
    certificatesIssued: Array<{ id: string; certId: string; title: string; status: string; issuedAt: string; recipientName: string }>;
    subscriptions: Array<{ id: string; plan: string; status: string; periodStart: string | null; periodEnd: string | null; postsUsed: number; postLimit: number | null }>;
    payments: Array<{ id: string; plan: string | null; amountCents: number; currency: string; status: string; receiptNumber: string | null; paidAt: string | null; createdAt: string }>;
    verificationRequests: Array<{ id: string; kind: string; status: string; submittedAt: string; reviewedAt: string | null; rejectionReason: string | null; documents: Array<{ id: string; type: string }> }>;
  };
  activeSessions: number;
  activity: Array<{ id: string; action: string; label: string; actorRole: string; createdAt: string; metadata: Record<string, unknown> | null }>;
}

export function UserDrawer({ id, onClose, onChanged }: { id: string | null; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "work" | "billing" | "activity">("overview");
  const confirm = useConfirm();
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const r = await adminApi<Detail>(`/api/admin/users/${id}`);
    if (r.ok && r.data) setD(r.data); else toast("error", r.error ?? "Could not load user");
    setLoading(false);
  }, [id, toast]);
  useEffect(() => { const t = setTimeout(() => { setD(null); setTab("overview"); void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function act(label: string, body: Record<string, unknown>, method: "PATCH" | "DELETE" = "PATCH") {
    if (!id) return;
    setBusy(label);
    const r = await adminApi<{ message?: string }>(`/api/admin/users/${id}`, method, method === "PATCH" ? body : undefined);
    setBusy(null);
    if (!r.ok) { toast("error", r.error ?? "Action failed"); return false; }
    toast("success", r.data?.message ?? `${label} done`);
    if (method === "DELETE") { onChanged(); onClose(); return true; }
    await load(); onChanged();
    return true;
  }

  const u = d?.user;
  const title = u ? u.name : "Account";

  async function suspend() {
    if (!u) return;
    const r = await confirm({ title: `Suspend ${u.name}?`, body: "They are signed out immediately and cannot sign in until reinstated. The reason is emailed to them.", confirmLabel: "Suspend account", tone: "danger", reason: { label: "Reason (sent to the user)", required: true, placeholder: "e.g. Fake submissions reported by two clients" } });
    if (r.ok) await act("Suspend", { suspended: true, reason: r.reason });
  }
  async function unsuspend() {
    if (!u) return;
    const r = await confirm({ title: `Reinstate ${u.name}?`, body: "They can sign in again right away and will be emailed.", confirmLabel: "Reinstate" });
    if (r.ok) await act("Reinstate", { suspended: false });
  }
  async function resetVerification() {
    if (!u) return;
    const r = await confirm({ title: "Reset verification?", body: "Their status returns to Not verified and any pending request is rejected. They must upload documents again.", confirmLabel: "Reset", tone: "danger", reason: { label: "Reason (sent to the user)", required: true } });
    if (r.ok) await act("Reset verification", { action: "RESET_VERIFICATION", reason: r.reason });
  }
  async function rename() {
    if (!u) return;
    const name = window.prompt("New display name", u.name);
    if (name && name.trim() && name.trim() !== u.name) await act("Rename", { name: name.trim() });
  }
  async function remove() {
    if (!u) return;
    const r = await confirm({ title: `Delete ${u.name} permanently?`, body: "Their projects, teams and applications go with them. Accounts that hold certificates or payments cannot be deleted — suspend those instead.", confirmLabel: "Delete account", tone: "danger" });
    if (r.ok) await act("Delete", {}, "DELETE");
  }

  return (
    <Drawer open={Boolean(id)} onClose={onClose} width={640} title={title}
      subtitle={u ? <span className="flex flex-wrap items-center gap-1.5">{u.email} · <Badge tone={u.role === "CLIENT" ? "navy" : "success"}>{u.role === "CLIENT" ? "Client" : "Talent"}</Badge><StatusBadge status={u.verificationStatus} />{u.suspendedAt && <Badge tone="danger" dot>Suspended</Badge>}</span> : undefined}
      footer={u && (
        <div className="flex flex-wrap items-center gap-2">
          {u.suspendedAt ? <Button size="sm" variant="primary" icon="check" loading={busy === "Reinstate"} onClick={unsuspend}>Reinstate</Button> : <Button size="sm" variant="danger" icon="ban" loading={busy === "Suspend"} onClick={suspend}>Suspend</Button>}
          {!u.emailVerifiedAt && <Button size="sm" variant="secondary" icon="mail" loading={busy === "Resend email"} onClick={() => act("Resend email", { action: "RESEND_VERIFICATION_EMAIL" })}>Resend confirmation</Button>}
          <Button size="sm" variant="secondary" icon="logout" loading={busy === "Sign out"} onClick={() => act("Sign out", { action: "REVOKE_SESSIONS" })}>Sign out everywhere</Button>
          {u.verificationStatus !== "UNVERIFIED" && <Button size="sm" variant="secondary" icon="idcard" loading={busy === "Reset verification"} onClick={resetVerification}>Reset verification</Button>}
          <Button size="sm" variant="ghost" onClick={rename}>Rename</Button>
          <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50" icon="trash" loading={busy === "Delete"} onClick={remove}>Delete</Button>
        </div>
      )}>
      {loading && !d ? <div className="flex items-center gap-2 py-10 text-slate-500"><Icon name="refresh" className="h-4 w-4 animate-spin" /> Loading…</div> : !u ? null : (
        <div>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={u.name} role={u.role} src={u.avatarUrl} size={12} />
            <div className="min-w-0 text-sm text-slate-600">
              <div>Joined {fmtDate(u.createdAt)} · {d!.activeSessions} active session{d!.activeSessions === 1 ? "" : "s"}</div>
              <div className="mt-0.5 flex flex-wrap gap-2 text-xs">
                <Link href={u.role === "CLIENT" ? `/clients/${u.id}` : `/talents/${u.id}`} target="_blank" className="font-semibold text-sky-700 hover:underline">Public profile ↗</Link>
                <a href={`mailto:${u.email}`} className="font-semibold text-sky-700 hover:underline">Email</a>
              </div>
            </div>
          </div>
          <Chips value={tab} onChange={setTab} options={[{ value: "overview", label: "Overview" }, { value: "work", label: u.role === "CLIENT" ? "Projects" : "Teams & certificates", count: u.role === "CLIENT" ? u.projectsPosted.length : u.certificatesEarned.length }, ...(u.role === "CLIENT" ? [{ value: "billing" as const, label: "Billing", count: u.payments.length }] : []), { value: "activity", label: "Activity", count: d!.activity.length }]} />

          {tab === "overview" && (
            <div>
              <Section title="Profile">
                <KeyValue items={[
                  ["Legal name", u.legalName], ["Email confirmed", u.emailVerifiedAt ? fmtDate(u.emailVerifiedAt) : <Badge tone="warning">No</Badge>],
                  ["Location", u.location], ["Website", u.website ? <a href={u.website} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">{u.website}</a> : null],
                  ...(u.role === "CLIENT" ? [["Type", u.clientType ? CLIENT_TYPE_LABEL[u.clientType as "INDIVIDUAL" | "ORGANIZATION"] : null], ["Industry", u.industry], ["Organization size", u.organizationSize], ["Free posts used", `${u.freePostsUsed}`]] as Array<[string, React.ReactNode]>
                    : [["University", u.universityName], ["Programme", u.degreeProgram], ["Portfolio", u.portfolioUrl], ["LinkedIn", u.linkedinUrl]] as Array<[string, React.ReactNode]>),
                ]} />
                {u.bio && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{u.bio}</p>}
                {u.skills.length > 0 && <div className="mt-3 flex flex-wrap gap-1">{u.skills.map(s => <Badge key={s}>{s}</Badge>)}</div>}
              </Section>
              <Section title="Verification">
                <KeyValue items={[["Status", <StatusBadge key="s" status={u.verificationStatus} />], ["Verified on", fmtDate(u.verifiedAt)], ["ID type", u.idType ? humanize(u.idType) : null], ["ID ending", u.idLast4 ? `···${u.idLast4}` : null]]} />
                {u.verificationRequests.length > 0 && (
                  <ul className="mt-3 divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {u.verificationRequests.map(v => (
                      <li key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span>{v.kind === "IDENTITY" ? "Identity" : "Organization"} · {fmtDateTime(v.submittedAt)}{v.rejectionReason && <span className="block text-xs text-red-700">{v.rejectionReason}</span>}</span>
                        <span className="flex items-center gap-2"><span className="text-xs text-slate-400">{v.documents.length} doc{v.documents.length === 1 ? "" : "s"}</span><StatusBadge status={v.status} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}

          {tab === "work" && u.role === "CLIENT" && (
            <Section title="Projects posted" count={u.projectsPosted.length}>
              {u.projectsPosted.length === 0 ? <p className="text-sm text-slate-500">No projects yet.</p> : (
                <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                  {u.projectsPosted.map(p => (
                    <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0"><Link href={`/projects/${p.id}`} target="_blank" className="font-semibold text-navy hover:underline">{p.title}</Link>{p.featured && <Badge tone="gold">Featured</Badge>}<span className="block text-xs text-slate-500">{p._count.applications} applications · {p._count.submissions} submissions · {p._count.certificates} certificates · {fmtDate(p.createdAt)}</span></span>
                      <StatusBadge status={p.status} />
                    </li>
                  ))}
                </ul>
              )}
              {u.certificatesIssued.length > 0 && (
                <div className="mt-4">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">Certificates issued</div>
                  <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">{u.certificatesIssued.map(c => <CertLine key={c.id} c={c} who={c.recipientName} />)}</ul>
                </div>
              )}
            </Section>
          )}
          {tab === "work" && u.role === "TALENT" && (
            <div>
              <Section title="Certificates earned" count={u.certificatesEarned.length}>
                {u.certificatesEarned.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">{u.certificatesEarned.map(c => <CertLine key={c.id} c={c} who={c.issuerName} />)}</ul>}
              </Section>
              <Section title="Teams" count={u.teamMemberships.length}>
                {u.teamMemberships.length === 0 ? <p className="text-sm text-slate-500">Not on any team.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {u.teamMemberships.map((m, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0"><span className="font-semibold text-navy">{m.team.name}</span> <span className="text-xs text-slate-500">· {m.role === "LEAD" ? "lead" : "member"} · <Link href={`/projects/${m.team.project.id}`} target="_blank" className="hover:underline">{m.team.project.title}</Link></span></span>
                        <StatusBadge status={m.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </div>
          )}

          {tab === "billing" && (
            <div>
              <Section title="Plans" count={u.subscriptions.length}>
                {u.subscriptions.length === 0 ? <p className="text-sm text-slate-500">Never subscribed.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {u.subscriptions.map(s => <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span><span className="font-semibold text-navy">{humanize(s.plan)}</span> <span className="text-xs text-slate-500">· {fmtDate(s.periodStart)} → {fmtDate(s.periodEnd)} · {s.postsUsed}{s.postLimit ? `/${s.postLimit}` : ""} posts</span></span><StatusBadge status={s.status} /></li>)}
                  </ul>
                )}
              </Section>
              <Section title="Payments" count={u.payments.length}>
                {u.payments.length === 0 ? <p className="text-sm text-slate-500">No payments.</p> : (
                  <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {u.payments.map(p => <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span><span className="font-semibold text-navy">{usd(p.amountCents)}</span> <span className="text-xs text-slate-500">· {p.plan ? humanize(p.plan) : "—"} · {fmtDateTime(p.paidAt ?? p.createdAt)}</span>{p.receiptNumber && <a href={`/api/billing/receipt/${p.id}`} target="_blank" rel="noreferrer" className="ml-2 font-mono text-[11px] text-sky-700 hover:underline">{p.receiptNumber}</a>}</span><StatusBadge status={p.status} /></li>)}
                  </ul>
                )}
              </Section>
            </div>
          )}

          {tab === "activity" && (
            <Section title="Recent activity" count={d!.activity.length}>
              {d!.activity.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded yet.</p> : (
                <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                  {d!.activity.map(a => (
                    <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0"><span className="text-navy">{a.label}</span> <span className="text-xs text-slate-400">by {a.actorRole.toLowerCase()}</span>{a.metadata && typeof a.metadata.reason === "string" && <span className="block text-xs text-slate-500">“{a.metadata.reason as string}”</span>}</span>
                      <span className="shrink-0 text-xs text-slate-400" title={fmtDateTime(a.createdAt)}>{relTime(a.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      )}
    </Drawer>
  );
}

function CertLine({ c, who }: { c: { id: string; certId: string; title: string; status: string; issuedAt: string }; who: string }) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="min-w-0"><Link href={`/certificates/${c.certId}`} target="_blank" className="font-semibold text-navy hover:underline">{c.title}</Link><span className="block text-xs text-slate-500">{who} · {fmtDate(c.issuedAt)} · <span className="font-mono">{c.certId}</span></span></span>
      <StatusBadge status={c.status} />
    </li>
  );
}
