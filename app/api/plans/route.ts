import { NextResponse } from "next/server";
import { FREE_POSTS, PERIOD_DAYS, planCatalog } from "@/lib/plans";

/** GET /api/plans — public plan catalog for the pricing page. */
export async function GET() {
  return NextResponse.json({ plans: planCatalog(), freePosts: FREE_POSTS, periodDays: PERIOD_DAYS, currency: "USD" });
}
