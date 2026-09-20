import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

/** POST /api/billing/cancel — stop renewal reminders; the current period stays active until it ends. */
export async function POST() {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;
  const sub = await prisma.subscription.findFirst({ where: { clientId: auth.userId, status: "ACTIVE", periodEnd: { gt: new Date() } } });
  if (!sub) return NextResponse.json({ error: "No active plan" }, { status: 404 });
  if (sub.cancelledAt) return NextResponse.json({ success: true, alreadyCancelled: true });
  await prisma.subscription.update({ where: { id: sub.id }, data: { cancelledAt: new Date() } });
  await audit(auth, "billing.cancelled", "subscription", sub.id, { plan: sub.plan, periodEnd: sub.periodEnd });
  return NextResponse.json({ success: true });
}
