import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { paging, searchTerm, toCsv } from "@/lib/admin";

const paymentSelect = {
  id: true, plan: true, amountCents: true, currency: true, status: true, providerRef: true, providerState: true, receiptNumber: true, paidAt: true, refundedAt: true, refundReason: true, createdAt: true,
  client: { select: { id: true, name: true, email: true, clientType: true } },
  subscription: { select: { id: true, status: true, periodEnd: true, postsUsed: true, postLimit: true } },
} satisfies Prisma.PaymentSelect;

/**
 * GET /api/admin/payments?q&status&page — payments with totals.
 * GET /api/admin/payments?format=csv — every non-cancelled payment as CSV.
 */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const q = searchTerm(url);
  const status = url.searchParams.get("status");
  const { page, skip, take } = paging(url);
  const where: Prisma.PaymentWhereInput = {
    ...(status && ["PENDING", "SUCCEEDED", "FAILED", "REFUNDED", "CANCELLED"].includes(status) ? { status: status as Prisma.PaymentWhereInput["status"] } : { status: { not: "CANCELLED" } }),
    ...(q ? { OR: [{ receiptNumber: { contains: q.toUpperCase() } }, { providerRef: { contains: q } }, { client: { name: { contains: q, mode: "insensitive" } } }, { client: { email: { contains: q, mode: "insensitive" } } }] } : {}),
  };

  if (url.searchParams.get("format") === "csv") {
    const rows = await prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000, select: paymentSelect });
    const csv = toCsv(rows.map(p => ({
      receipt: p.receiptNumber, status: p.status, plan: p.plan, amount_usd: (p.amountCents / 100).toFixed(2), currency: p.currency,
      client: p.client.name, email: p.client.email, client_type: p.client.clientType, paid_at: p.paidAt, refunded_at: p.refundedAt, refund_reason: p.refundReason,
      provider_ref: p.providerRef, provider_state: p.providerState, created_at: p.createdAt,
    })));
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="certitask-payments-${new Date().toISOString().slice(0, 10)}.csv"` } });
  }

  const [total, payments, succeeded, active] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy: { createdAt: "desc" }, skip, take, select: paymentSelect }),
    prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
    prisma.subscription.count({ where: { status: "ACTIVE", periodEnd: { gt: new Date() } } }),
  ]);
  return NextResponse.json({ payments, total, page, pageSize: take, totals: { revenueCents: succeeded._sum.amountCents ?? 0, paidCount: succeeded._count, activeSubscriptions: active } });
}
