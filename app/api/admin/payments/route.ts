import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/** GET /api/admin/payments — all payments with client + plan, newest first, plus totals. */
export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const [payments, succeeded, active] = await Promise.all([
    prisma.payment.findMany({
      where: { status: { not: "CANCELLED" } },
      select: {
        id: true, plan: true, amountCents: true, currency: true, status: true, providerRef: true, providerState: true, receiptNumber: true, paidAt: true, refundedAt: true, refundReason: true, createdAt: true,
        client: { select: { id: true, name: true, email: true, clientType: true } },
        subscription: { select: { id: true, status: true, periodEnd: true, postsUsed: true, postLimit: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.subscription.count({ where: { status: "ACTIVE", periodEnd: { gt: new Date() } } }),
  ]);
  return NextResponse.json({ payments, totals: { revenueCents: succeeded._sum.amountCents ?? 0, paidCount: succeeded._count, activeSubscriptions: active } });
}
