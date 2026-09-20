import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { isString } from "@/lib/validation";
import { PROJECT_CATEGORIES, TEAM_CAP_MAX, TEAM_CAP_MIN, isOneOf } from "@/lib/enums";
import { projectListInclude } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { parseDeadline, parseSkills } from "@/lib/projects";
import { notify } from "@/lib/notifications";
import { BillingError, consumePost, getEntitlement } from "@/lib/billing";

type Params = { params: Promise<{ id: string }> };

/** GET /api/projects/[id] — public for ACTIVE projects; owner sees any status. */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const session = await getSession();

  try {
    const project = await prisma.project.findUnique({ where: { id }, include: projectListInclude });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const isOwner = session?.role === "CLIENT" && session.userId === project.clientId;
    const isAdmin = session?.role === "ADMIN";
    if (!isOwner && !isAdmin && project.status !== "ACTIVE") {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (error) {
    console.error("Fetch project error:", error);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

/** Status changes a client may make directly. Payment/verification gates come in later phases. */
const CLIENT_STATUS_TRANSITIONS: Record<string, string[]> = {
  ACTIVE: ["PAUSED", "CLOSED"],
  PAUSED: ["ACTIVE", "CLOSED"],
  CLOSED: [],
  COMPLETED: [],
  DRAFT: ["ACTIVE"],
  PENDING_PAYMENT: [],
};

/** PATCH /api/projects/[id] — owner edits fields or changes status. */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();

    const project = await prisma.project.findUnique({ where: { id } });
    if (!project || project.clientId !== auth.userId) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (body.status !== undefined) {
      const allowed = CLIENT_STATUS_TRANSITIONS[project.status] ?? [];
      if (typeof body.status !== "string" || !allowed.includes(body.status)) {
        return NextResponse.json({ error: `Cannot change a ${project.status.toLowerCase()} project to ${String(body.status).toLowerCase()}` }, { status: 400 });
      }
      data.status = body.status;
      if (body.status === "ACTIVE" && !project.publishedAt) data.publishedAt = new Date();
      if (body.status === "CLOSED") data.closedAt = new Date();
    }

    if (body.title !== undefined) {
      if (!isString(body.title, 200)) return NextResponse.json({ error: "Title is required" }, { status: 400 });
      data.title = body.title.trim();
    }
    if (body.description !== undefined) {
      if (!isString(body.description, 10000)) return NextResponse.json({ error: "Description is required" }, { status: 400 });
      data.description = body.description.trim();
    }
    if (body.deliverables !== undefined) {
      if (!isString(body.deliverables, 10000)) return NextResponse.json({ error: "Deliverables are required" }, { status: 400 });
      data.deliverables = body.deliverables.trim();
    }
    if (body.category !== undefined) {
      if (!isOneOf(PROJECT_CATEGORIES, body.category)) return NextResponse.json({ error: "Invalid category" }, { status: 400 });
      data.category = body.category;
    }
    if (body.requiredSkills !== undefined) {
      const skills = parseSkills(body.requiredSkills);
      if (skills.length === 0) return NextResponse.json({ error: "Add at least one required skill" }, { status: 400 });
      data.requiredSkills = skills;
    }
    if (body.deadline !== undefined) {
      const d = parseDeadline(body.deadline);
      if (!d || d <= new Date()) return NextResponse.json({ error: "Deadline must be a date in the future" }, { status: 400 });
      data.deadline = d;
    }
    if (body.teamCap !== undefined) {
      const cap = Number(body.teamCap);
      if (!Number.isInteger(cap) || cap < TEAM_CAP_MIN || cap > TEAM_CAP_MAX) {
        return NextResponse.json({ error: `Team size must be between ${TEAM_CAP_MIN} and ${TEAM_CAP_MAX}` }, { status: 400 });
      }
      if (cap < project.teamCap) {
        const largest = await prisma.team.findFirst({
          where: { projectId: id, application: { isNot: null } },
          select: { _count: { select: { members: { where: { status: "ACCEPTED" } } } } },
          orderBy: { members: { _count: "desc" } },
        });
        if (largest && largest._count.members > cap) {
          return NextResponse.json({ error: `A team of ${largest._count.members} has already applied; team size can't be lower than that.` }, { status: 409 });
        }
      }
      data.teamCap = cap;
    }

    if (body.featured !== undefined) {
      const ent = await getEntitlement(auth.userId);
      if (body.featured && !ent.features.featured) {
        return NextResponse.json({ error: "Featured projects are a Pro plan perk", billing: "PLAN_REQUIRED" }, { status: 402 });
      }
      data.featured = !!body.featured;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const publishing = data.status === "ACTIVE" && project.status === "DRAFT";
    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const u = await tx.project.update({ where: { id }, data, include: projectListInclude });
        await audit(auth, data.status ? "project.status_changed" : "project.updated", "project", id, { from: project.status, to: u.status, fields: Object.keys(data) }, tx);
        if (!publishing) return u;
        await consumePost(tx, auth.userId, id);
        return tx.project.findUniqueOrThrow({ where: { id }, include: projectListInclude }); // picks up the plan link
      }, { maxWait: 10_000, timeout: 30_000 });
    } catch (e) {
      if (e instanceof BillingError) return NextResponse.json({ error: e.message, billing: e.code }, { status: e.status });
      throw e;
    }

    // Selected teams hear about a moved deadline.
    if (data.deadline instanceof Date && data.deadline.getTime() !== project.deadline.getTime()) {
      const members = await prisma.teamMember.findMany({
        where: { status: "ACCEPTED", team: { projectId: id, application: { status: "SELECTED" } } },
        select: { userId: true },
      });
      const when = data.deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      for (const m of members) {
        await notify(m.userId, "deadline.reminder", `Deadline changed: ${updated.title}`, `The client moved the deadline to ${when}.`, "/talent/dashboard?tab=submissions");
      }
    }

    return NextResponse.json({ success: true, project: updated });
  } catch (error) {
    console.error("Update project error:", error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
