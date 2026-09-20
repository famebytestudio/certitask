"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DashboardResponse } from "@/lib/types";

/** Loads /api/dashboard once and exposes a `refresh()` for after mutations. */
export function useDashboardData() {
  const router = useRouter();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.status === 401) { router.replace("/auth/login"); return; }
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Failed to load dashboard"); return; }
      setData(json as DashboardResponse);
      setError(null);
    } catch {
      setError("Network error. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => { void refresh(); }, 0);
    return () => clearTimeout(t);
  }, [refresh]);

  return { data, loading, error, refresh };
}

/** Keeps the active tab in the URL (?tab=) so deep links and refreshes work. */
export function useTabParam<T extends string>(valid: readonly T[], fallback: T): [T, (t: T) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const fromUrl = params.get("tab");
  const active = (valid as readonly string[]).includes(fromUrl ?? "") ? (fromUrl as T) : fallback;
  const set = useCallback((t: T) => {
    const next = new URLSearchParams(params.toString());
    if (t === fallback) next.delete("tab"); else next.set("tab", t);
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [params, router, fallback]);
  return [active, set];
}

export async function signOut() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth/login");
}

/** POST/PATCH JSON and return { ok, error, data }. */
export async function api<T = unknown>(url: string, method: "POST" | "PATCH" | "DELETE", body?: unknown): Promise<{ ok: boolean; error?: string; code?: string; data?: T }> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json.error ?? `Request failed (${res.status})`, code: json.billing ?? json.code };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
