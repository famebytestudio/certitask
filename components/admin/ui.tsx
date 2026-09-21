"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

/* ─────────────────────────── formatting ─────────────────────────── */

export const fmtDate = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const fmtDateTime = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
export const usd = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`;
export const relTime = (iso: string | Date) => {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
};
export const humanize = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, c => c.toUpperCase());

/* ─────────────────────────── icons (inline, 1.5px stroke) ─────────────────────────── */

const PATHS: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-18v6h8V3h-8z",
  users: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  idcard: "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2",
  projects: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  certificate: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  card: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z",
  mail: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z",
  list: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  chevron: "M9 5l7 7-7 7",
  logout: "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  external: "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14",
  check: "M5 13l4 4L19 7",
  alert: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  menu: "M4 6h16M4 12h16M4 18h16",
  refresh: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
  download: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4",
  eye: "M15 12a3 3 0 11-6 0 3 3 0 016 0zm6 0c-1.5 4-5 7-9 7s-7.5-3-9-7c1.5-4 5-7 9-7s7.5 3 9 7z",
  star: "M11.05 3.5a1 1 0 011.9 0l1.68 3.4 3.75.55a1 1 0 01.55 1.7l-2.7 2.64.64 3.73a1 1 0 01-1.45 1.05L12 14.8l-3.36 1.77a1 1 0 01-1.45-1.05l.64-3.73-2.7-2.64a1 1 0 01.55-1.7l3.75-.55 1.62-3.4z",
  archive: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
  trash: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  reply: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  activity: "M13 10V3L4 14h7v7l9-11h-7z",
  ban: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
  user: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  building: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
};
export function Icon({ name, className = "w-5 h-5" }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={PATHS[name] ?? PATHS.alert} />
    </svg>
  );
}

/* ─────────────────────────── badges & status ─────────────────────────── */

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "navy" | "gold";
const TONE: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/15",
  navy: "bg-navy text-white ring-navy",
  gold: "bg-gold/15 text-[#7A5E10] ring-gold/40",
};
export function Badge({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset whitespace-nowrap ${TONE[tone]}`}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
export function statusTone(status: string): Tone {
  switch (status) {
    case "VERIFIED": case "ACTIVE": case "SUCCEEDED": case "APPROVED": case "SELECTED": case "COMPLETED": case "ACCEPTED": return "success";
    case "PENDING_REVIEW": case "PENDING": case "PENDING_PAYMENT": case "SUBMITTED": case "SHORTLISTED": case "INVITED": case "CHANGES_REQUESTED": case "DISPUTED": case "PAUSED": return "warning";
    case "REJECTED": case "REVOKED": case "FAILED": case "SUSPENDED": case "WITHDRAWN": return "danger";
    case "DRAFT": case "CLOSED": case "EXPIRED": case "CANCELLED": case "UNVERIFIED": case "REFUNDED": case "DECLINED": return "neutral";
    default: return "neutral";
  }
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={statusTone(status)}>{humanize(status)}</Badge>;

/* ─────────────────────────── buttons ─────────────────────────── */

type Variant = "primary" | "secondary" | "danger" | "ghost" | "gold";
const VARIANT: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark shadow-sm",
  secondary: "bg-white text-navy ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-navy",
  gold: "bg-gold text-navy hover:bg-[#b8921f] shadow-sm",
};
export function Button({ variant = "primary", size = "md", loading, icon, className = "", children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean; icon?: string }) {
  return (
    <button {...rest} disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm"} ${VARIANT[variant]} ${className}`}>
      {loading ? <Spinner className="h-3.5 w-3.5" /> : icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}
export const Spinner = ({ className = "h-5 w-5" }: { className?: string }) => (
  <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-label="Loading"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>
);

/* ─────────────────────────── layout pieces ─────────────────────────── */

export function Card({ children, className = "", padded = true }: { children: ReactNode; className?: string; padded?: boolean }) {
  return <div className={`rounded-xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,42,74,0.05)] ${padded ? "p-5" : ""} ${className}`}>{children}</div>;
}
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight text-navy">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export function StatCard({ label, value, hint, tone = "navy", onClick }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "navy" | "gold" | "success" | "warning" | "danger"; onClick?: () => void }) {
  const accent = { navy: "bg-navy", gold: "bg-gold", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-red-500" }[tone];
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={`relative overflow-hidden rounded-xl bg-white p-4 text-left ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,42,74,0.05)] ${onClick ? "transition hover:ring-navy/40 hover:shadow-md" : ""}`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${accent}`} />
      <div className="pl-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
        <div className="mt-1 text-2xl font-extrabold tabular-nums text-navy">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
      </div>
    </Comp>
  );
}
export function EmptyState({ icon = "list", title, hint, action }: { icon?: string; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Icon name={icon} className="h-6 w-6" /></div>
      <div className="text-sm font-bold text-navy">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-xs text-slate-500">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
export function Avatar({ name, role, src, size = 8 }: { name: string; role?: string | null; src?: string | null; size?: 8 | 10 | 12 }) {
  const bg = role === "CLIENT" ? "bg-navy text-gold" : role === "TALENT" ? "bg-emerald-600 text-white" : "bg-slate-500 text-white";
  const cls = { 8: "h-8 w-8 text-xs", 10: "h-10 w-10 text-sm", 12: "h-12 w-12 text-base" }[size];
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt="" className={`${cls} rounded-full object-cover`} /> : <div className={`${cls} flex shrink-0 items-center justify-center rounded-full font-bold ${bg}`}>{name.trim().charAt(0).toUpperCase() || "?"}</div>;
}
export function KeyValue({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-slate-100 py-1.5 sm:block sm:border-0 sm:py-0">
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{k}</dt>
          <dd className="text-right font-medium text-ink sm:text-left break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Section({ title, children, count, action }: { title: string; children: ReactNode; count?: number; action?: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{title}{typeof count === "number" && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{count}</span>}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/* ─────────────────────────── table + toolbar ─────────────────────────── */

export function Table({ head, children, minWidth = 720, busy }: { head: ReactNode; children: ReactNode; minWidth?: number; busy?: boolean }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }} aria-busy={busy || undefined}>
          <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr>{head}</tr></thead>
          <tbody className={`divide-y divide-slate-100 transition-opacity ${busy ? "opacity-50" : ""}`}>{children}</tbody>
        </table>
      </div>
    </Card>
  );
}
export const Th = ({ children, className = "", right }: { children?: ReactNode; className?: string; right?: boolean }) => <th className={`px-4 py-3 ${right ? "text-right" : ""} ${className}`}>{children}</th>;
export const Td = ({ children, className = "", right }: { children?: ReactNode; className?: string; right?: boolean }) => <td className={`px-4 py-3 align-middle ${right ? "text-right" : ""} ${className}`}>{children}</td>;
export const Row = ({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) => (
  <tr onClick={onClick} className={`${onClick ? "cursor-pointer" : ""} transition hover:bg-slate-50/70 ${active ? "bg-gold/10" : ""}`}>{children}</tr>
);
export function LoadingRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className="px-4 py-3.5"><div className="h-3 animate-pulse rounded bg-slate-100" style={{ width: `${55 + ((i * 7 + j * 13) % 40)}%` }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`relative block ${className}`}>
      <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search"
        className="w-full rounded-lg bg-white py-2 pl-8 pr-3 text-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-navy" />
    </label>
  );
}
export function Select({ value, onChange, options, className = "", "aria-label": label }: { value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; className?: string; "aria-label"?: string }) {
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={`rounded-lg bg-white py-2 pl-3 pr-8 text-sm font-medium text-navy ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-navy ${className}`}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} className={`rounded-full px-3 py-1.5 text-xs font-bold transition ring-1 ring-inset ${value === o.value ? "bg-navy text-white ring-navy" : "bg-white text-slate-600 ring-slate-300 hover:ring-navy"}`}>
          {o.label}{typeof o.count === "number" && <span className={`ml-1.5 rounded px-1 ${value === o.value ? "bg-white/20" : "bg-slate-100"}`}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div>;
}
export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>Showing <strong className="text-navy">{(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)}</strong> of {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

/* ─────────────────────────── drawer, dialog, toasts ─────────────────────────── */

export function Drawer({ open, onClose, title, subtitle, children, width = 560, footer }: { open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full flex-col bg-white shadow-2xl" style={{ maxWidth: width }}>
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <div className="truncate text-lg font-extrabold text-navy">{title}</div>
            {subtitle && <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-navy"><Icon name="x" /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="border-t border-slate-200 bg-slate-50 px-5 py-3">{footer}</footer>}
      </aside>
    </div>
  );
}

export interface ConfirmOptions { title: string; body?: ReactNode; confirmLabel?: string; tone?: "danger" | "primary"; reason?: { label: string; required?: boolean; placeholder?: string } }
type ConfirmFn = (opts: ConfirmOptions) => Promise<{ ok: boolean; reason: string }>;
const ConfirmCtx = createContext<ConfirmFn>(() => Promise.resolve({ ok: false, reason: "" }));
export const useConfirm = () => useContext(ConfirmCtx);

interface ToastItem { id: number; kind: "success" | "error" | "info"; text: string }
const ToastCtx = createContext<{ toast: (kind: ToastItem["kind"], text: string) => void }>({ toast: () => {} });
export const useToast = () => useContext(ToastCtx);

/** Provides `useConfirm()` (promise-based dialog) and `useToast()` to the admin tree. */
export function AdminUiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toast = useCallback((kind: ToastItem["kind"], text: string) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  const [dlg, setDlg] = useState<(ConfirmOptions & { resolve: (r: { ok: boolean; reason: string }) => void }) | null>(null);
  const [reason, setReason] = useState("");
  const confirm = useCallback<ConfirmFn>((opts) => new Promise(resolve => { setReason(""); setDlg({ ...opts, resolve }); }), []);
  const close = (ok: boolean) => { if (!dlg) return; dlg.resolve({ ok, reason: reason.trim() }); setDlg(null); };
  const reasonMissing = Boolean(dlg?.reason?.required) && reason.trim().length === 0;
  const toastValue = useMemo(() => ({ toast }), [toast]);
  const firstField = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => { if (dlg?.reason) firstField.current?.focus(); }, [dlg]);

  return (
    <ToastCtx.Provider value={toastValue}>
      <ConfirmCtx.Provider value={confirm}>
        {children}
        {/* toasts */}
        <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
          {toasts.map(t => (
            <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${t.kind === "success" ? "bg-emerald-600" : t.kind === "error" ? "bg-red-600" : "bg-navy"}`}>
              <Icon name={t.kind === "success" ? "check" : t.kind === "error" ? "alert" : "activity"} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{t.text}</span>
            </div>
          ))}
        </div>
        {/* confirm dialog */}
        {dlg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
            <div className="absolute inset-0 bg-navy/50 backdrop-blur-[2px]" onClick={() => close(false)} />
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-start gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${dlg.tone === "danger" ? "bg-red-50 text-red-600" : "bg-navy/10 text-navy"}`}><Icon name={dlg.tone === "danger" ? "alert" : "check"} /></div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-extrabold text-navy">{dlg.title}</h3>
                  {dlg.body && <div className="mt-1 text-sm text-slate-600">{dlg.body}</div>}
                </div>
              </div>
              {dlg.reason && (
                <div className="mt-4">
                  <label className="mb-1 block text-xs font-bold text-slate-600">{dlg.reason.label}{dlg.reason.required && <span className="text-red-600"> *</span>}</label>
                  <textarea ref={firstField} id="confirm-reason" rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder={dlg.reason.placeholder}
                    className="w-full rounded-lg px-3 py-2 text-sm ring-1 ring-inset ring-slate-300 focus:outline-none focus:ring-2 focus:ring-navy" />
                </div>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
                <Button variant={dlg.tone === "danger" ? "danger" : "primary"} disabled={reasonMissing} onClick={() => close(true)}>{dlg.confirmLabel ?? "Confirm"}</Button>
              </div>
            </div>
          </div>
        )}
      </ConfirmCtx.Provider>
    </ToastCtx.Provider>
  );
}

/* ─────────────────────────── fetch helper ─────────────────────────── */

export async function adminApi<T = unknown>(url: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data?.error ?? `Request failed (${res.status})` };
  } catch {
    return { ok: false, status: 0, data: null, error: "Network error" };
  }
}

/** Debounce a changing value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
