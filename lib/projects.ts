/** Input parsing shared by the project create/update routes. */

const PLAN_RANK: Record<string, number> = { PRO: 3, GROWTH: 2, STARTER: 1 };

/**
 * Public listing order: featured first, then paid-plan rank (Pro > Growth > Starter/free),
 * then most recently published. Small lists, so sorting in memory is fine.
 */
export function rankProjects<T extends { featured?: boolean; publishedAt?: Date | string | null; createdAt?: Date | string; subscription?: { plan: string } | null }>(list: T[]): T[] {
  const ts = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);
  return [...list].sort((a, b) =>
    Number(!!b.featured) - Number(!!a.featured) ||
    (PLAN_RANK[b.subscription?.plan ?? ""] ?? 0) - (PLAN_RANK[a.subscription?.plan ?? ""] ?? 0) ||
    ts(b.publishedAt ?? b.createdAt) - ts(a.publishedAt ?? a.createdAt)
  );
}

export function parseSkills(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(new Set(raw.map((s) => String(s).trim()).filter((s) => s.length > 0 && s.length <= 40))).slice(0, 20);
}

export function parseDeadline(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  // Accept a date-only string as end-of-day UTC so "today" is still valid.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) d.setUTCHours(23, 59, 59, 999);
  return d;
}
