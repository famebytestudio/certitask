import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";
import { FREE_POSTS, PERIOD_DAYS, planCatalog } from "@/lib/plans";

/** GET /api/billing — entitlement, current plan, history and payments for the signed-in client. */
export async function GET() {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;

  const [entitlement, subscriptions, payments] = await Promise.all([
    getEntitlement(auth.userId),
    prisma.subscription.findMany({
      where: { clientId: auth.userId, status: { not: "PENDING_PAYMENT" } },
      select: { id: true, plan: true, status: true, periodStart: true, periodEnd: true, postsUsed: true, postLimit: true, cancelledAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 24,
    }),
    prisma.payment.findMany({
      where: { clientId: auth.userId, status: { in: ["SUCCEEDED", "REFUNDED", "FAILED"] } },
      select: { id: true, plan: true, amountCents: true, currency: true, status: true, receiptNumber: true, paidAt: true, refundedAt: true, refundReason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return NextResponse.json({ entitlement, subscriptions, payments, plans: planCatalog(), freePosts: FREE_POSTS, periodDays: PERIOD_DAYS });
}
