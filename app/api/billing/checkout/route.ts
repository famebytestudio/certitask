import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { BillingError, startCheckout } from "@/lib/billing";
import { PLAN_TIERS, type PlanTier } from "@/lib/plans";
import { isRateLimited } from "@/lib/rate-limit";

/** POST /api/billing/checkout { plan } — start a hosted checkout; returns the URL to send the client to. */
export async function POST(req: Request) {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;
  if (await isRateLimited(`checkout:${auth.userId}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again later." }, { status: 429 });
  }
  try {
    const { plan } = await req.json();
    if (!PLAN_TIERS.includes(plan)) return NextResponse.json({ error: "Choose a plan" }, { status: 400 });
    const result = await startCheckout(auth, plan as PlanTier);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    if (e instanceof BillingError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
    console.error("Checkout error:", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }
}
