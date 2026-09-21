import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PROJECT_STATUSES, isOneOf } from "@/lib/enums";
import { audit } from "@/lib/audit";
import { auditLabel } from "@/lib/admin";
import { notify } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

/** GET /api/admin/projects/[id] — project with its teams, applications, submissions, certificates and activity. */
export async function GET(_req: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { id } = await params;

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true, title: true, description: true, category: true, requiredSkills: true, deliverables: true, deadline: true, teamCap: true, status: true, featured: true, viewCount: true, createdAt: true, publishedAt: true, closedAt: true,
        client: { select: { id: true, name: true, email: true, clientType: true, verificationStatus: true } },
        subscription: { select: { plan: true } },
        teams: { select: { id: true, name: true, lead: { select: { id: true, name: true } }, _count: { select: { members: true } }, application: { select: { id: true, status: true, createdAt: true } }, submission: { select: { id: true, status: true, createdAt: true, submissionUrl: true } } } },
        certificates: { select: { id: true, certId: true, recipientName: true, status: true, issuedAt: true } },
      },
    });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    const activity = await prisma.auditLog.findMany({ where: { entityType: "project", entityId: id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, actorRole: true, metadata: true, createdAt: true } });
    return NextResponse.json({ project, activity: activity.map(a => ({ ...a, label: auditLabel(a.action) })) });
  } catch (error) {
    console.error("Admin project detail error:", error);
    return NextResponse.json({ error: "Failed to load project" }, { status: 500 });
  }
}

/** PATCH /api/admin/projects/[id] — { title?, status?, featured?, reason? }. The owner is notified of status changes. */
export async function PATCH(request: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const { id } = await params;
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    const { title, status, featured, reason } = body as { title?: unknown; status?: unknown; featured?: unknown; reason?: unknown };

    const data: { title?: string; status?: (typeof PROJECT_STATUSES)[number]; closedAt?: Date | null; featured?: boolean; publishedAt?: Date } = {};
    if (typeof title === "string" && title.trim().length > 0) data.title = title.trim().slice(0, 200);
    if (isOneOf(PROJECT_STATUSES, status)) {
      data.status = status;
      if (status === "CLOSED") data.closedAt = new Date();
      if (status === "ACTIVE") data.closedAt = null;
    }
    if (typeof featured === "boolean") data.featured = featured;
    if (Object.keys(data).length === 0) return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });

    const target = await prisma.project.findUnique({ where: { id }, select: { id: true, status: true, title: true, clientId: true, publishedAt: true } });
    if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (data.status === "ACTIVE" && !target.publishedAt) data.publishedAt = new Date();

    const updated = await prisma.project.update({ where: { id }, data });
    const reasonText = typeof reason === "string" ? reason.trim().slice(0, 500) : null;
    await audit(authorization, "project.admin_updated", "project", id, { from: target.status, to: updated.status, fields: Object.keys(data), reason: reasonText });
    if (data.status && data.status !== target.status) {
      await notify(target.clientId, "submission.reviewed", `"${target.title}" is now ${data.status.toLowerCase()}`, `An administrator changed the project status.${reasonText ? ` Reason: ${reasonText}` : ""}`, "/client/dashboard?tab=projects");
    }
    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}

/** DELETE /api/admin/projects/[id] — blocked once certificates exist; close it instead. */
export async function DELETE(_request: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const { id } = await params;
    const target = await prisma.project.findUnique({ where: { id }, select: { id: true, title: true, clientId: true, _count: { select: { certificates: true, submissions: true } } } });
    if (!target) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    if (target._count.certificates > 0) {
      return NextResponse.json({ error: `${target._count.certificates} certificate(s) were issued for this project. Close it instead of deleting.` }, { status: 409 });
    }
    await prisma.project.delete({ where: { id } });
    await audit(authorization, "project.deleted", "project", id, { title: target.title, submissions: target._count.submissions });
    await notify(target.clientId, "submission.reviewed", `"${target.title}" was removed`, "An administrator removed this project.", "/client/dashboard?tab=projects");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 });
  }
}
