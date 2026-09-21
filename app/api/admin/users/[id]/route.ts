import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { auditLabel } from "@/lib/admin";
import { sendAccountStatusEmail } from "@/lib/email";
import { sendEmailVerification } from "@/lib/email-verification";
import { notify } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/users/[id] — everything an admin needs to understand one account. */
export async function GET(_req: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { id } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true, name: true, email: true, role: true, clientType: true, legalName: true, verificationStatus: true, verifiedAt: true, emailVerifiedAt: true,
        suspendedAt: true, createdAt: true, updatedAt: true, avatarUrl: true, bio: true, website: true, location: true, industry: true, organizationSize: true,
        universityName: true, degreeProgram: true, skills: true, portfolioUrl: true, linkedinUrl: true, idType: true, idLast4: true, freePostsUsed: true,
        projectsPosted: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, status: true, createdAt: true, featured: true, _count: { select: { applications: true, submissions: true, certificates: true } } } },
        teamMemberships: { orderBy: { invitedAt: "desc" }, take: 20, select: { role: true, status: true, team: { select: { id: true, name: true, project: { select: { id: true, title: true, status: true } } } } } },
        certificatesEarned: { orderBy: { issuedAt: "desc" }, take: 20, select: { id: true, certId: true, title: true, status: true, issuedAt: true, issuerName: true } },
        certificatesIssued: { orderBy: { issuedAt: "desc" }, take: 20, select: { id: true, certId: true, title: true, status: true, issuedAt: true, recipientName: true } },
        subscriptions: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, plan: true, status: true, periodStart: true, periodEnd: true, postsUsed: true, postLimit: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 20, select: { id: true, plan: true, amountCents: true, currency: true, status: true, receiptNumber: true, paidAt: true, createdAt: true } },
        verificationRequests: { orderBy: { submittedAt: "desc" }, take: 5, select: { id: true, kind: true, status: true, submittedAt: true, reviewedAt: true, rejectionReason: true, documents: { where: { deletedAt: null }, select: { id: true, type: true } } } },
      },
    });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const [activeSessions, activity] = await Promise.all([
      prisma.session.count({ where: { userId: id, revokedAt: null, expiresAt: { gt: new Date() } } }),
      prisma.auditLog.findMany({ where: { OR: [{ actorId: id }, { entityType: "user", entityId: id }] }, orderBy: { createdAt: "desc" }, take: 25, select: { id: true, action: true, actorRole: true, entityType: true, entityId: true, metadata: true, createdAt: true } }),
    ]);

    return NextResponse.json({ user, activeSessions, activity: activity.map(a => ({ ...a, label: auditLabel(a.action) })) });
  } catch (error) {
    console.error("Admin user detail error:", error);
    return NextResponse.json({ error: "Failed to load user" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[id]
 *  { name }                                   rename
 *  { suspended: true, reason }                suspend (revokes sessions, emails the user)
 *  { suspended: false }                       unsuspend (emails the user)
 *  { action: "RESEND_VERIFICATION_EMAIL" }
 *  { action: "REVOKE_SESSIONS" }              sign out everywhere
 *  { action: "RESET_VERIFICATION", reason }   back to UNVERIFIED so they can resubmit
 */
export async function PATCH(request: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const { suspended, name, action, reason } = body as { suspended?: unknown; name?: unknown; action?: unknown; reason?: unknown };
    const reasonText = typeof reason === "string" ? reason.trim().slice(0, 1000) : "";

    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true, suspendedAt: true, emailVerifiedAt: true, verificationStatus: true } });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const dashboard = `${process.env.APP_URL ?? ""}/${target.role === "CLIENT" ? "client" : "talent"}/dashboard`;

    if (action === "RESEND_VERIFICATION_EMAIL") {
      if (target.emailVerifiedAt) return NextResponse.json({ error: "This email address is already confirmed" }, { status: 409 });
      await sendEmailVerification(target);
      await audit(authorization, "user.verification_email_resent", "user", id, {});
      return NextResponse.json({ success: true, message: `Verification email sent to ${target.email}` });
    }

    if (action === "REVOKE_SESSIONS") {
      const r = await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await audit(authorization, "user.sessions_revoked", "user", id, { count: r.count });
      return NextResponse.json({ success: true, message: `Signed out of ${r.count} session${r.count === 1 ? "" : "s"}` });
    }

    if (action === "RESET_VERIFICATION") {
      if (!reasonText) return NextResponse.json({ error: "Give the user a reason" }, { status: 400 });
      await prisma.$transaction([
        prisma.verificationRequest.updateMany({ where: { userId: id, status: "PENDING_REVIEW" }, data: { status: "REJECTED", reviewedAt: new Date(), reviewedBy: "super-admin", rejectionReason: reasonText } }),
        prisma.user.update({ where: { id }, data: { verificationStatus: "UNVERIFIED", verifiedAt: null } }),
      ]);
      await audit(authorization, "verification.reset", "user", id, { reason: reasonText });
      await notify(id, "verification.rejected", "Verification reset", `An admin reset your verification: ${reasonText} Please submit your documents again.`, `/${target.role === "CLIENT" ? "client" : "talent"}/dashboard?tab=verification`);
      void sendAccountStatusEmail(target.email, target.name, "VERIFICATION_RESET", reasonText, dashboard).catch(e => console.error("account email failed:", e));
      return NextResponse.json({ success: true, message: "Verification reset; the user was asked to resubmit" });
    }

    const data: { name?: string; suspendedAt?: Date | null } = {};
    if (typeof suspended === "boolean") data.suspendedAt = suspended ? new Date() : null;
    if (typeof name === "string" && name.trim().length > 0) data.name = name.trim().slice(0, 120);
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    if (suspended === true && !reasonText) return NextResponse.json({ error: "Give a reason for the suspension; it is shown to the user" }, { status: 400 });

    if (suspended === true) await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    const updated = await prisma.user.update({ where: { id }, data, select: { id: true, name: true, role: true, suspendedAt: true, verificationStatus: true } });

    if (typeof suspended === "boolean" && suspended !== Boolean(target.suspendedAt)) {
      await audit(authorization, suspended ? "user.suspended" : "user.unsuspended", "user", id, { reason: reasonText || null });
      void sendAccountStatusEmail(target.email, target.name, suspended ? "SUSPENDED" : "REINSTATED", reasonText || null, dashboard).catch(e => console.error("account email failed:", e));
    }
    if (data.name && data.name !== target.name) await audit(authorization, "user.renamed", "user", id, { from: target.name, to: data.name });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

/** DELETE /api/admin/users/[id] — only accounts with no certificates and no successful payments. */
export async function DELETE(_request: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const { id } = await params;
    const target = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, role: true, _count: { select: { certificatesEarned: true, certificatesIssued: true, projectsPosted: true } } },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const paid = await prisma.payment.count({ where: { clientId: id, status: { in: ["SUCCEEDED", "REFUNDED"] } } });
    const blockers: string[] = [];
    if (target._count.certificatesEarned > 0) blockers.push(`${target._count.certificatesEarned} certificate(s) earned`);
    if (target._count.certificatesIssued > 0) blockers.push(`${target._count.certificatesIssued} certificate(s) issued`);
    if (paid > 0) blockers.push(`${paid} payment record(s)`);
    if (blockers.length > 0) {
      return NextResponse.json({ error: `This account has ${blockers.join(", ")}, which must be kept. Suspend it instead.` }, { status: 409 });
    }

    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } }); // cascades projects/teams/applications
    await audit(authorization, "user.deleted", "user", id, { email: target.email, role: target.role, projects: target._count.projectsPosted });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
