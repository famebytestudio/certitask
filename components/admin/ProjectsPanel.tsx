"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Drawer, EmptyState, Icon, KeyValue, LoadingRows, PageHeader, Pagination, Row, SearchInput, Section, Select, StatusBadge, Table, Td, Th, Toolbar, adminApi, fmtDate, fmtDateTime, humanize, relTime, useConfirm, useDebounced, useToast } from "./ui";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, PROJECT_CATEGORY_LABEL, type ProjectCategory } from "@/lib/enums";

interface ProjectRow {
  id: string; title: string; category: string; status: string; featured: boolean; viewCount: number; deadline: string; createdAt: string; publishedAt: string | null; teamCap: number;
  client: { id: string; name: string; email: string; clientType: string | null }; subscription: { plan: string } | null;
  _count: { applications: number; submissions: number; certificates: number; teams: number };
}
interface ListResp { projects: ProjectRow[]; total: number; page: number; pageSize: number }
export interface ProjectsQuery extends Record<string, string | undefined> { q?: string; status?: string; featured?: string; page?: string; project?: string }

export function ProjectsPanel({ query, setQuery, onChanged, openUser }: { query: ProjectsQuery; setQuery: (q: ProjectsQuery) => void; onChanged: () => void; openUser: (id: string) => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const page = Number(query.page ?? 1);
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page) });
    if (dq) p.set("q", dq); if (query.status) p.set("status", query.status); if (query.featured) p.set("featured", query.featured);
    const r = await adminApi<ListResp>(`/api/admin/projects?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, dq, query.status, query.featured]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  return (
    <div>
      <PageHeader title="Projects" subtitle="Everything clients have posted, including drafts." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search title or client…" className="w-full sm:w-72" />
        <Select aria-label="Status" value={query.status ?? ""} onChange={v => setQuery({ ...query, status: v || undefined, page: undefined })} options={[{ value: "", label: "Any status" }, ...PROJECT_STATUSES.map(s => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))]} />
        <Select aria-label="Featured" value={query.featured ?? ""} onChange={v => setQuery({ ...query, featured: v || undefined, page: undefined })} options={[{ value: "", label: "Featured or not" }, { value: "1", label: "Featured only" }]} />
      </Toolbar>
      <Table busy={loading} head={<><Th>Project</Th><Th>Client</Th><Th>Status</Th><Th>Pipeline</Th><Th>Deadline</Th><Th right>Views</Th></>}>
        {loading && !data ? <LoadingRows cols={6} /> : !data || data.projects.length === 0 ? (
          <tr><td colSpan={6}><EmptyState icon="projects" title="No projects match" /></td></tr>
        ) : data.projects.map(p => (
          <Row key={p.id} onClick={() => setQuery({ ...query, project: p.id })} active={query.project === p.id}>
            <Td><div className="max-w-xs truncate font-semibold text-navy">{p.featured && <Icon name="star" className="mr-1 inline h-3.5 w-3.5 text-gold" />}{p.title}</div><div className="text-xs text-slate-500">{PROJECT_CATEGORY_LABEL[p.category as ProjectCategory] ?? humanize(p.category)}{p.subscription && ` · ${humanize(p.subscription.plan)} plan`}</div></Td>
            <Td><div className="text-sm text-navy">{p.client.name}</div><div className="text-xs text-slate-500">{p.client.email}</div></Td>
            <Td><StatusBadge status={p.status} /></Td>
            <Td className="text-xs text-slate-600">{p._count.applications} applied · {p._count.submissions} submitted · {p._count.certificates} certified</Td>
            <Td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(p.deadline)}</Td>
            <Td right className="tabular-nums text-slate-600">{p.viewCount}</Td>
          </Row>
        ))}
      </Table>
      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} />}
      <ProjectDrawer id={query.project ?? null} onClose={() => setQuery({ ...query, project: undefined })} onChanged={() => { void load(); onChanged(); }} openUser={openUser} />
    </div>
  );
}

interface Detail {
  project: {
    id: string; title: string; description: string; category: string; requiredSkills: string[]; deliverables: string; deadline: string; teamCap: number; status: string; featured: boolean; viewCount: number; createdAt: string; publishedAt: string | null; closedAt: string | null;
    client: { id: string; name: string; email: string; clientType: string | null; verificationStatus: string }; subscription: { plan: string } | null;
    teams: Array<{ id: string; name: string; lead: { id: string; name: string }; _count: { members: number }; application: { id: string; status: string; createdAt: string } | null; submission: { id: string; status: string; createdAt: string; submissionUrl: string } | null }>;
    certificates: Array<{ id: string; certId: string; recipientName: string; status: string; issuedAt: string }>;
  };
  activity: Array<{ id: string; action: string; label: string; actorRole: string; createdAt: string; metadata: Record<string, unknown> | null }>;
}

function ProjectDrawer({ id, onClose, onChanged, openUser }: { id: string | null; onClose: () => void; onChanged: () => void; openUser: (id: string) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();
  const load = useCallback(async () => { if (!id) return; const r = await adminApi<Detail>(`/api/admin/projects/${id}`); if (r.ok && r.data) setD(r.data); else toast("error", r.error ?? "Could not load project"); }, [id, toast]);
  useEffect(() => { const t = setTimeout(() => { setD(null); void load(); }, 0); return () => clearTimeout(t); }, [load]);

  async function patch(label: string, body: Record<string, unknown>) {
    if (!id) return;
    setBusy(label);
    const r = await adminApi(`/api/admin/projects/${id}`, "PATCH", body);
    setBusy(null);
    if (!r.ok) { toast("error", r.error ?? "Failed"); return; }
    toast("success", `${label} done`); await load(); onChanged();
  }
  async function changeStatus(status: string) {
    const r = await confirm({ title: `Set status to ${PROJECT_STATUS_LABEL[status as keyof typeof PROJECT_STATUS_LABEL] ?? status}?`, body: "The client is notified in-app.", confirmLabel: "Change status", reason: { label: "Reason (optional, shown to the client)" } });
    if (r.ok) await patch("Status change", { status, reason: r.reason || undefined });
  }
  async function remove() {
    if (!d) return;
    const r = await confirm({ title: `Delete “${d.project.title}”?`, body: "Teams, applications and submissions go with it. Projects with certificates cannot be deleted — close them instead.", confirmLabel: "Delete project", tone: "danger" });
    if (!r.ok || !id) return;
    setBusy("Delete");
    const res = await adminApi(`/api/admin/projects/${id}`, "DELETE");
    setBusy(null);
    if (!res.ok) { toast("error", res.error ?? "Failed"); return; }
    toast("success", "Project deleted"); onChanged(); onClose();
  }
  const p = d?.project;
  return (
    <Drawer open={Boolean(id)} onClose={onClose} width={680} title={p?.title ?? "Project"} subtitle={p ? <span className="flex flex-wrap items-center gap-1.5"><StatusBadge status={p.status} />{p.featured && <Badge tone="gold">Featured</Badge>}<span>· {PROJECT_CATEGORY_LABEL[p.category as ProjectCategory] ?? humanize(p.category)} · {p.viewCount} views</span></span> : undefined}
      footer={p && (
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Change status" value="" onChange={v => { if (v) void changeStatus(v); }} options={[{ value: "", label: "Change status…" }, ...PROJECT_STATUSES.filter(s => s !== p.status).map(s => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))]} />
          <Button size="sm" variant="secondary" icon="star" loading={busy === "Feature"} onClick={() => patch("Feature", { featured: !p.featured })}>{p.featured ? "Unfeature" : "Feature"}</Button>
          <Link href={`/projects/${p.id}`} target="_blank" className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy ring-1 ring-inset ring-slate-300 hover:bg-slate-50">Open page <Icon name="external" className="h-3.5 w-3.5" /></Link>
          <Button size="sm" variant="ghost" className="ml-auto text-red-600 hover:bg-red-50" icon="trash" loading={busy === "Delete"} onClick={remove}>Delete</Button>
        </div>
      )}>
      {!p ? <div className="py-10 text-sm text-slate-500">Loading…</div> : (
        <div>
          <Section title="Client">
            <button onClick={() => openUser(p.client.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ring-1 ring-slate-200 hover:bg-slate-50">
              <span><span className="font-semibold text-navy">{p.client.name}</span> <span className="text-xs text-slate-500">· {p.client.email}</span></span>
              <StatusBadge status={p.client.verificationStatus} />
            </button>
          </Section>
          <Section title="Details">
            <KeyValue items={[["Created", fmtDate(p.createdAt)], ["Published", fmtDate(p.publishedAt)], ["Deadline", fmtDate(p.deadline)], ["Closed", fmtDate(p.closedAt)], ["Team size", `up to ${p.teamCap}`], ["Counted against", p.subscription ? `${humanize(p.subscription.plan)} plan` : "free posts"]]} />
            <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{p.description}</p>
            <div className="mt-2 text-xs text-slate-500"><strong>Deliverables:</strong> {p.deliverables}</div>
            <div className="mt-2 flex flex-wrap gap-1">{p.requiredSkills.map(s => <Badge key={s}>{s}</Badge>)}</div>
          </Section>
          <Section title="Teams & submissions" count={p.teams.length}>
            {p.teams.length === 0 ? <p className="text-sm text-slate-500">No applications yet.</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                {p.teams.map(t => (
                  <li key={t.id} className="px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span><span className="font-semibold text-navy">{t.name}</span> <span className="text-xs text-slate-500">· lead <button onClick={() => openUser(t.lead.id)} className="text-sky-700 hover:underline">{t.lead.name}</button> · {t._count.members} member{t._count.members === 1 ? "" : "s"}</span></span>
                      {t.application ? <StatusBadge status={t.application.status} /> : <Badge>No application</Badge>}
                    </div>
                    {t.submission && <div className="mt-1 flex items-center justify-between gap-2 text-xs text-slate-600"><span>Submission {fmtDateTime(t.submission.createdAt)} · <a href={t.submission.submissionUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">open deliverable ↗</a></span><StatusBadge status={t.submission.status} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Certificates" count={p.certificates.length}>
            {p.certificates.length === 0 ? <p className="text-sm text-slate-500">None issued.</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                {p.certificates.map(c => <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span><Link href={`/certificates/${c.certId}`} target="_blank" className="font-semibold text-navy hover:underline">{c.recipientName}</Link> <span className="font-mono text-xs text-slate-400">{c.certId}</span> <span className="text-xs text-slate-500">· {fmtDate(c.issuedAt)}</span></span><StatusBadge status={c.status} /></li>)}
              </ul>
            )}
          </Section>
          <Section title="Activity" count={d!.activity.length}>
            {d!.activity.length === 0 ? <p className="text-sm text-slate-500">Nothing recorded.</p> : (
              <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                {d!.activity.map(a => <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm"><span>{a.label} <span className="text-xs text-slate-400">by {a.actorRole.toLowerCase()}</span></span><span className="text-xs text-slate-400">{relTime(a.createdAt)}</span></li>)}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Drawer>
  );
}
