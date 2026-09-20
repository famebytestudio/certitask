/**
 * Client plans (Phase 4). Prices are in USD cents; Safepay converts to PKR at
 * checkout. Override any price with env: PLAN_PRICE_STARTER_CENTS etc.
 */
export type PlanTier = "STARTER" | "GROWTH" | "PRO";
export const PLAN_TIERS: PlanTier[] = ["STARTER", "GROWTH", "PRO"];

export const FREE_POSTS = /^\d+$/.test(process.env.FREE_POSTS ?? "") ? Number(process.env.FREE_POSTS) : 2; // lifetime, verified clients only
export const PERIOD_DAYS = 30;

function price(env: string, fallback: number): number {
  const v = Number(process.env[env]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export interface PlanDef {
  tier: PlanTier;
  name: string;
  tagline: string;
  priceCents: number;
  postLimit: number | null; // per 30-day period; null = unlimited
  perks: string[];
  features: {
    applicantFilters: boolean; // filter applicants by verification / skills / team size
    priorityVisibility: boolean; // sorted above free listings
    analytics: boolean; // per-project views & application stats
    featured: boolean; // "Featured" badge + homepage/listing spotlight
    prioritySupport: boolean; // contact messages flagged for admin
  };
}

export const PLANS: Record<PlanTier, PlanDef> = {
  STARTER: {
    tier: "STARTER",
    name: "Starter",
    tagline: "For occasional projects",
    priceCents: price("PLAN_PRICE_STARTER_CENTS", 500),
    postLimit: 5,
    perks: ["5 project posts per 30 days", "Applications & team rosters", "Email and in-app notifications", "Public client profile"],
    features: { applicantFilters: false, priorityVisibility: false, analytics: false, featured: false, prioritySupport: false },
  },
  GROWTH: {
    tier: "GROWTH",
    name: "Growth",
    tagline: "For clients who post regularly",
    priceCents: price("PLAN_PRICE_GROWTH_CENTS", 1000),
    postLimit: 15,
    perks: ["15 project posts per 30 days", "Everything in Starter", "Applicant filters (verified, skills, team size)", "Priority visibility in listings", "Project analytics"],
    features: { applicantFilters: true, priorityVisibility: true, analytics: true, featured: false, prioritySupport: false },
  },
  PRO: {
    tier: "PRO",
    name: "Pro",
    tagline: "For high-volume clients",
    priceCents: price("PLAN_PRICE_PRO_CENTS", 2000),
    postLimit: null,
    perks: ["Unlimited project posts", "Everything in Growth", "Featured projects", "Priority support", "Top placement in listings"],
    features: { applicantFilters: true, priorityVisibility: true, analytics: true, featured: true, prioritySupport: true },
  },
};

export const PLAN_RANK: Record<PlanTier, number> = { STARTER: 1, GROWTH: 2, PRO: 3 };

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/** Public, serialisable view of the plan table for pricing pages. */
export function planCatalog() {
  return PLAN_TIERS.map((t) => {
    const p = PLANS[t];
    return { tier: p.tier, name: p.name, tagline: p.tagline, priceCents: p.priceCents, price: formatUsd(p.priceCents), postLimit: p.postLimit, perks: p.perks, features: p.features };
  });
}
