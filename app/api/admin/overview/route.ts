import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { auditLabel } from "@/lib/admin";

const DAY = 86_400_000;

/**
 * GET /api/admin/overview — KPIs, the "needs attention" queue, 30-day series
 * (signups, revenue) and the latest audit entries for the admin dashboard.
 */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const now = new Date();

    // ?light=1 — just the sidebar badge counts (cheap; polled after every admin action).
    if (new URL(req.url).searchParams.get("light") === "1") {
      const [pendingVerifications, unreadMessages, certificatesDisputed] = await Promise.all([
        prisma.verificationRequest.count({ where: { status: "PENDING_REVIEW" } }),
        prisma.contactMessage.count({ where: { isRead: false, archivedAt: null } }),
        prisma.certificate.count({ where: { status: "DISPUTED" } }),
      ]);
      return NextResponse.json({ counts: { pendingVerifications, unreadMessages, certificatesDisputed } });
    }
    const weekAgo = new Date(now.getTime() - 7 * DAY);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 29 * DAY);

    const [
      clients, talents, projects, activeProjects, applications, submissionsThisWeek,
      certificatesIssued, certificatesRevoked, certificatesDisputed, pendingVerifications, unreadMessages, totalMessages,
      revenueAll, revenueMonth, activeSubscriptions, failedPayments,
      newUsers, paidPayments, attentionVerifications, attentionMessages, attentionDisputes, attentionMismatch, recent,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "CLIENT" } }),
      prisma.user.count({ where: { role: "TALENT" } }),
      prisma.project.count(),
      prisma.project.count({ where: { status: "ACTIVE" } }),
      prisma.application.count(),
      prisma.submission.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.certificate.count({ where: { status: "VERIFIED" } }),
      prisma.certificate.count({ where: { status: "REVOKED" } }),
      prisma.certificate.count({ where: { status: "DISPUTED" } }),
      prisma.verificationRequest.count({ where: { status: "PENDING_REVIEW" } }),
      prisma.contactMessage.count({ where: { isRead: false, archivedAt: null } }),
      prisma.contactMessage.count({ where: { archivedAt: null } }),
      prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amountCents: true }, _count: true }),
      prisma.payment.aggregate({ where: { status: "SUCCEEDED", paidAt: { gte: monthStart } }, _sum: { amountCents: true }, _count: true }),
      prisma.subscription.count({ where: { status: "ACTIVE", periodEnd: { gt: now } } }),
      prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: weekAgo } } }),
      prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, role: true } }),
      prisma.payment.findMany({ where: { status: "SUCCEEDED", paidAt: { gte: since } }, select: { paidAt: true, amountCents: true } }),
      prisma.verificationRequest.findMany({ where: { status: "PENDING_REVIEW" }, orderBy: { submittedAt: "asc" }, take: 5, select: { id: true, submittedAt: true, kind: true, user: { select: { id: true, name: true, role: true } } } }),
      prisma.contactMessage.findMany({ where: { isRead: false, archivedAt: null }, orderBy: [{ priority: "desc" }, { createdAt: "desc" }], take: 5, select: { id: true, name: true, subject: true, priority: true, createdAt: true } }),
      prisma.certificate.findMany({ where: { status: "DISPUTED" }, orderBy: { statusChangedAt: "desc" }, take: 5, select: { id: true, certId: true, recipientName: true, title: true, statusChangedAt: true } }),
      prisma.auditLog.findMany({ where: { action: { in: ["billing.amount_mismatch", "billing.webhook_rejected"] }, createdAt: { gte: weekAgo } }, orderBy: { createdAt: "desc" }, take: 3, select: { id: true, action: true, entityId: true, createdAt: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 12, select: { id: true, action: true, actorRole: true, actorId: true, entityType: true, entityId: true, metadata: true, createdAt: true } }),
    ]);

    // Daily buckets for the last 30 days (UTC), zero-filled.
    const days: string[] = [];
    for (let i = 0; i < 30; i++) days.push(new Date(since.getTime() + i * DAY).toISOString().slice(0, 10));
    const signups = Object.fromEntries(days.map(d => [d, { clients: 0, talents: 0 }])) as Record<string, { clients: number; talents: number }>;
    for (const u of newUsers) { const k = u.createdAt.toISOString().slice(0, 10); if (signups[k]) signups[k][u.role === "CLIENT" ? "clients" : "talents"]++; }
    const revenue = Object.fromEntries(days.map(d => [d, 0])) as Record<string, number>;
    for (const p of paidPayments) { const k = p.paidAt!.toISOString().slice(0, 10); if (k in revenue) revenue[k] += p.amountCents; }

    // Resolve actor names for the activity feed in one query.
    const actorIds = [...new Set(recent.map(r => r.actorId).filter((x): x is string => !!x && x !== "super-admin"))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [];
    const actorName = (id: string | null, role: string) => id === "super-admin" || role === "ADMIN" ? "Admin" : role === "SYSTEM" ? "System" : actors.find(a => a.id === id)?.name ?? "Deleted user";

    return NextResponse.json({
      counts: {
        clients, talents, projects, activeProjects, applications, submissionsThisWeek,
        certificatesIssued, certificatesRevoked, certificatesDisputed, pendingVerifications, unreadMessages, totalMessages,
        revenueCents: revenueAll._sum.amountCents ?? 0, paidCount: revenueAll._count,
        revenueMonthCents: revenueMonth._sum.amountCents ?? 0, paidCountMonth: revenueMonth._count,
        activeSubscriptions, failedPayments,
      },
      attention: {
        verifications: attentionVerifications,
        messages: attentionMessages,
        disputes: attentionDisputes,
        paymentIssues: attentionMismatch.map(a => ({ ...a, label: auditLabel(a.action) })),
      },
      series: {
        days,
        signups: days.map(d => signups[d]),
        revenueCents: days.map(d => revenue[d]),
      },
      recent: recent.map(r => ({ ...r, label: auditLabel(r.action), actorName: actorName(r.actorId, r.actorRole) })),
    });
  } catch (err) {
    console.error("Admin overview error:", err);
    return NextResponse.json({ error: "Failed to fetch admin overview" }, { status: 500 });
  }
}
