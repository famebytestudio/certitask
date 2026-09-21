"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Chips, EmptyState, Icon, PageHeader, Pagination, SearchInput, Spinner, Toolbar, adminApi, fmtDateTime, relTime, useConfirm, useDebounced, useToast } from "./ui";

interface Msg { id: string; name: string; email: string; subject: string | null; message: string; type: string; priority: boolean; isRead: boolean; readAt: string | null; archivedAt: string | null; createdAt: string; account: { id: string; role: string; name: string } | null }
interface ListResp { messages: Msg[]; total: number; page: number; pageSize: number; unread: number }
export interface MessagesQuery extends Record<string, string | undefined> { box?: string; q?: string; page?: string; message?: string }

/** Contact-form inbox: Pro clients first, unread highlighted, mark-read on open, archive, reply by email, jump to the account. */
export function MessagesPanel({ query, setQuery, onChanged, openUser }: { query: MessagesQuery; setQuery: (q: MessagesQuery) => void; onChanged: () => void; openUser: (id: string) => void }) {
  const [q, setQ] = useState(query.q ?? "");
  const dq = useDebounced(q, 300);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  const { toast } = useToast();
  const box = query.box ?? "inbox";
  const page = Number(query.page ?? 1);
  const selectedId = query.message ?? null;
  useEffect(() => { if ((query.q ?? "") !== dq) setQuery({ ...query, q: dq || undefined, page: undefined }); }, [dq]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams({ page: String(page), box });
    if (dq) p.set("q", dq);
    const r = await adminApi<ListResp>(`/api/admin/messages?${p}`);
    if (r.ok && r.data) setData(r.data);
    setLoading(false);
  }, [page, box, dq]);
  useEffect(() => { const t = setTimeout(() => { void load(); }, 0); return () => clearTimeout(t); }, [load]);

  const selected = data?.messages.find(m => m.id === selectedId) ?? null;

  async function patch(m: Msg, body: Record<string, unknown>, label?: string) {
    setBusy(m.id);
    const r = await adminApi(`/api/admin/messages/${m.id}`, "PATCH", body);
    setBusy(null);
    if (!r.ok) { toast("error", r.error ?? "Failed"); return; }
    if (label) toast("success", label);
    await load(); onChanged();
  }
  async function open(m: Msg) {
    setQuery({ ...query, message: m.id });
    if (!m.isRead) {
      // optimistic: flip locally, then persist
      setData(d => d ? { ...d, unread: Math.max(0, d.unread - 1), messages: d.messages.map(x => x.id === m.id ? { ...x, isRead: true, readAt: new Date().toISOString() } : x) } : d);
      const r = await adminApi(`/api/admin/messages/${m.id}`, "PATCH", { read: true });
      if (r.ok) onChanged();
    }
  }
  async function remove(m: Msg) {
    const r = await confirm({ title: "Delete this message?", body: "This cannot be undone. Archive it instead if you might need it later.", confirmLabel: "Delete", tone: "danger" });
    if (!r.ok) return;
    setBusy(m.id);
    const res = await adminApi(`/api/admin/messages/${m.id}`, "DELETE");
    setBusy(null);
    if (!res.ok) { toast("error", res.error ?? "Failed"); return; }
    toast("success", "Message deleted"); setQuery({ ...query, message: undefined }); await load(); onChanged();
  }
  const replyHref = (m: Msg) => `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to CertiTask"}`)}&body=${encodeURIComponent(`\n\n----\nOn ${fmtDateTime(m.createdAt)} ${m.name} wrote:\n${m.message}`)}`;

  return (
    <div>
      <PageHeader title="Messages" subtitle="Contact-form messages. Pro clients are always shown first." />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search sender, subject or text…" className="w-full sm:w-72" />
        <Chips value={box} onChange={v => setQuery({ ...query, box: v === "inbox" ? undefined : v, page: undefined, message: undefined })} options={[{ value: "inbox", label: "Inbox" }, { value: "unread", label: "Unread", count: data?.unread }, { value: "archived", label: "Archived" }]} />
      </Toolbar>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card padded={false} className="lg:col-span-2">
          {loading && !data ? <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Spinner className="h-4 w-4" /> Loading…</div>
            : !data || data.messages.length === 0 ? <EmptyState icon="mail" title={box === "archived" ? "Nothing archived" : box === "unread" ? "Inbox zero" : "No messages"} hint={box === "unread" ? "Every message has been read." : undefined} />
              : (
                <ul className="divide-y divide-slate-100">
                  {data.messages.map(m => (
                    <li key={m.id}>
                      <button onClick={() => open(m)} className={`flex w-full flex-col gap-0.5 px-4 py-3 text-left transition hover:bg-slate-50 ${selectedId === m.id ? "bg-gold/10" : ""}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${m.isRead ? "font-medium text-slate-700" : "font-extrabold text-navy"}`}>{!m.isRead && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-gold align-middle" />}{m.name}</span>
                          <span className="shrink-0 text-[11px] text-slate-400">{relTime(m.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          {m.priority && <Badge tone="gold">Pro</Badge>}
                          <span className={`truncate ${m.isRead ? "text-slate-500" : "text-navy"}`}>{m.subject || "No subject"}</span>
                        </div>
                        <div className="truncate text-xs text-slate-400">{m.message}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          {data && <div className="px-4 pb-3"><Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={p => setQuery({ ...query, page: String(p) })} /></div>}
        </Card>

        <Card className="lg:col-span-3">
          {!selected ? <EmptyState icon="mail" title="Select a message" hint="Opening a message marks it as read." /> : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-extrabold text-navy">{selected.subject || "No subject"}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <span className="font-semibold text-navy">{selected.name}</span>
                    <a href={`mailto:${selected.email}`} className="text-sky-700 hover:underline">{selected.email}</a>
                    {selected.priority && <Badge tone="gold">Pro client · priority</Badge>}
                    {selected.type !== "contact" && <Badge>{selected.type.replace(/_/g, " ")}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-slate-400">Received {fmtDateTime(selected.createdAt)}{selected.readAt && ` · read ${fmtDateTime(selected.readAt)}`}{selected.archivedAt && ` · archived ${fmtDateTime(selected.archivedAt)}`}</div>
                </div>
                {selected.account ? (
                  <button onClick={() => openUser(selected.account!.id)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-navy ring-1 ring-inset ring-slate-300 hover:bg-slate-50"><Icon name="user" className="h-3.5 w-3.5" /> {selected.account.role === "CLIENT" ? "Client" : "Talent"} account</button>
                ) : <Badge>No account</Badge>}
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{selected.message}</p>
              <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                <a href={replyHref(selected)} className="inline-flex items-center gap-1.5 rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-dark"><Icon name="reply" className="h-4 w-4" /> Reply by email</a>
                <Button variant="secondary" size="sm" icon={selected.isRead ? "mail" : "check"} loading={busy === selected.id} onClick={() => patch(selected, { read: !selected.isRead })}>{selected.isRead ? "Mark unread" : "Mark read"}</Button>
                <Button variant="secondary" size="sm" icon="archive" loading={busy === selected.id} onClick={() => patch(selected, { archived: !selected.archivedAt }, selected.archivedAt ? "Moved back to inbox" : "Archived")}>{selected.archivedAt ? "Unarchive" : "Archive"}</Button>
                <Button variant="ghost" size="sm" className="ml-auto text-red-600 hover:bg-red-50" icon="trash" loading={busy === selected.id} onClick={() => remove(selected)}>Delete</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
