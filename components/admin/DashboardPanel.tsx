"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Icon, PageHeader, Section, Spinner, StatCard, adminApi, fmtDate, relTime, usd } from "./ui";
import { TimeSeries } from "./Charts";
import type { AdminTab } from "@/app/admin/dashboard/page";

interface Overview {
  counts: { clients: number; talents: number; projects: number; activeProjects: number; applications: number; submissionsThisWeek: number; certificatesIssued: number; certificatesRevoked: number; certificatesDisputed: number; pendingVerifications: number; unreadMessages: number; totalMessages: number; revenueCents: number; paidCount: number; revenueMonthCents: number; paidCountMonth: number; activeSubscriptions: number; failedPayments: number };
  attention: {
    verifications: Array<{ id: string; submittedAt: string; kind: string; user: { id: string; name: string; role: string } }>;
    messages: Array<{ id: string; name: string; subject: string | null; priority: boolean; createdAt: string }>;
    disputes: Array<{ id: string; certId: string; recipientName: string; title: string; statusChangedAt: string | null }>;
    paymentIssues: Array<{ id: string; action: string; entityId: string; createdAt: string; label: string }>;
  };
  series: { days: string[]; signups: Array<{ clients: number; talents: number }>; revenueCents: number[] };
  recent: Array<{ id: string; action: string; label: string; actorName: string; actorRole: string; entityType: string; entityId: string; metadata: Record<string, unknown> | null; createdAt: string }>;
}

const dayLabel = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function DashboardPanel({ goTo, openUser }: { goTo: (tab: AdminTab, query?: Record<string, string>) => void; openUser: (id: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await adminApi<Overview>("/api/admin/overview");
    if (r.ok && r.data) { setData(r.data); setError(null); } else setError(r.error);
    setLoading(false);
  }, []);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  if (loading && !data) return <div className="flex items-center gap-3 py-16 text-slate-500"><Spinner /> Loading overview…</div>;
  if (error || !data) return <EmptyState icon="alert" title="Could not load the overview" hint={error ?? undefined} action={<Button onClick={load} icon="refresh">Retry</Button>} />;
  const c = data.counts;
  const attentionCount = c.pendingVerifications + c.unreadMessages + c.certificatesDisputed + data.attention.paymentIssues.length;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`As of ${new Date().toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`} actions={<Button variant="secondary" size="sm" icon="refresh" loading={loading} onClick={load}>Refresh</Button>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Clients" value={c.clients} tone="navy" onClick={() => goTo("users", { role: "CLIENT" })} />
        <StatCard label="Talent" value={c.talents} tone="navy" onClick={() => goTo("users", { role: "TALENT" })} />
        <StatCard label="Active projects" value={c.activeProjects} hint={`${c.projects} total`} tone="gold" onClick={() => goTo("projects", { status: "ACTIVE" })} />
        <StatCard label="Revenue this month" value={usd(c.revenueMonthCents)} hint={`${c.paidCountMonth} payment${c.paidCountMonth === 1 ? "" : "s"} · ${usd(c.revenueCents)} all time`} tone="success" onClick={() => goTo("payments")} />
        <StatCard label="Active plans" value={c.activeSubscriptions} hint={c.failedPayments ? `${c.failedPayments} failed this week` : "no failures this week"} tone={c.failedPayments ? "warning" : "success"} onClick={() => goTo("payments")} />
        <StatCard label="Certificates" value={c.certificatesIssued} hint={`${c.certificatesDisputed} disputed · ${c.certificatesRevoked} revoked`} tone={c.certificatesDisputed ? "warning" : "navy"} onClick={() => goTo("certificates")} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Needs attention */}
        <Card className="xl:col-span-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-navy">Needs attention</h2>
            <Badge tone={attentionCount ? "warning" : "success"}>{attentionCount ? `${attentionCount} open` : "all clear"}</Badge>
          </div>
          {attentionCount === 0 ? <p className="text-sm text-slate-500">Nothing is waiting on you.</p> : (
            <div className="space-y-4">
              {data.attention.verifications.length > 0 && (
                <AttentionGroup title={`Verifications to review (${c.pendingVerifications})`} onAll={() => goTo("verifications")}>
                  {data.attention.verifications.map(v => (
                    <button key={v.id} onClick={() => goTo("verifications")} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="truncate"><span className="font-semibold text-navy">{v.user.name}</span> <span className="text-slate-500">· {v.kind === "IDENTITY" ? "identity" : "organization"} · {v.user.role.toLowerCase()}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{relTime(v.submittedAt)}</span>
                    </button>
                  ))}
                </AttentionGroup>
              )}
              {data.attention.messages.length > 0 && (
                <AttentionGroup title={`Unread messages (${c.unreadMessages})`} onAll={() => goTo("messages", { box: "unread" })}>
                  {data.attention.messages.map(m => (
                    <button key={m.id} onClick={() => goTo("messages", { box: "unread" })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="truncate">{m.priority && <Badge tone="gold">Pro</Badge>} <span className="font-semibold text-navy">{m.subject || "No subject"}</span> <span className="text-slate-500">· {m.name}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{relTime(m.createdAt)}</span>
                    </button>
                  ))}
                </AttentionGroup>
              )}
              {data.attention.disputes.length > 0 && (
                <AttentionGroup title={`Disputed certificates (${c.certificatesDisputed})`} onAll={() => goTo("certificates", { status: "DISPUTED" })}>
                  {data.attention.disputes.map(d => (
                    <button key={d.id} onClick={() => goTo("certificates", { q: d.certId })} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50">
                      <span className="truncate"><span className="font-semibold text-navy">{d.recipientName}</span> <span className="text-slate-500">· {d.title}</span></span>
                      <span className="shrink-0 font-mono text-[11px] text-slate-400">{d.certId}</span>
                    </button>
                  ))}
                </AttentionGroup>
              )}
              {data.attention.paymentIssues.length > 0 && (
                <AttentionGroup title="Payment issues (7 days)" onAll={() => goTo("audit", { action: "billing" })}>
                  {data.attention.paymentIssues.map(p => (
                    <div key={p.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                      <span className="truncate text-red-700">{p.label} <span className="font-mono text-[11px] text-slate-400">{p.entityId.slice(0, 8)}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{relTime(p.createdAt)}</span>
                    </div>
                  ))}
                </AttentionGroup>
              )}
            </div>
          )}
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:col-span-2">
          <Card>
            <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-extrabold text-navy">New accounts</h2><span className="text-xs text-slate-500">last 30 days</span></div>
            <TimeSeries title="New accounts per day, last 30 days" kind="bar" points={data.series.days.map((d, i) => ({ label: dayLabel(d), value: data.series.signups[i].clients + data.series.signups[i].talents }))} />
          </Card>
          <Card>
            <div className="mb-2 flex items-baseline justify-between"><h2 className="text-sm font-extrabold text-navy">Revenue</h2><span className="text-xs text-slate-500">USD · last 30 days</span></div>
            <TimeSeries title="Revenue per day in USD, last 30 days" kind="area" format={v => usd(v)} points={data.series.days.map((d, i) => ({ label: dayLabel(d), value: data.series.revenueCents[i] }))} />
          </Card>
          <Card className="md:col-span-2">
            <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[["Applications", c.applications], ["Submissions this week", c.submissionsThisWeek], ["Messages", c.totalMessages], ["Pending verifications", c.pendingVerifications]].map(([l, v]) => (
                <div key={l as string}><div className="text-xl font-extrabold tabular-nums text-navy">{v as number}</div><div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{l as string}</div></div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Activity */}
      <Section title="Recent activity" action={<Button variant="ghost" size="sm" onClick={() => goTo("audit")}>Open audit log <Icon name="chevron" className="h-3.5 w-3.5" /></Button>}>
        <Card padded={false}>
          {data.recent.length === 0 ? <EmptyState title="No activity yet" /> : (
            <ul className="divide-y divide-slate-100">
              {data.recent.map(r => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${/revoked|rejected|deleted|suspended|mismatch/.test(r.action) ? "bg-red-500" : /approved|issued|activated|verified/.test(r.action) ? "bg-emerald-500" : "bg-slate-300"}`} />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-semibold text-navy">{r.actorName}</span> <span className="text-slate-600">{r.label.toLowerCase()}</span>
                    {r.entityType === "user" ? <button onClick={() => openUser(r.entityId)} className="ml-1 text-xs font-semibold text-sky-700 hover:underline">view account</button> : r.entityType === "project" ? <Link href={`/projects/${r.entityId}`} target="_blank" className="ml-1 text-xs font-semibold text-sky-700 hover:underline">open project ↗</Link> : null}
                    {r.metadata && typeof r.metadata.title === "string" && <span className="ml-1 text-slate-400">· {r.metadata.title as string}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400" title={fmtDate(r.createdAt)}>{relTime(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Section>
    </div>
  );
}

function AttentionGroup({ title, children, onAll }: { title: string; children: React.ReactNode; onAll: () => void }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}</div>
        <button onClick={onAll} className="text-[11px] font-bold text-navy hover:underline">View all</button>
      </div>
      <div className="-mx-2">{children}</div>
    </div>
  );
}
