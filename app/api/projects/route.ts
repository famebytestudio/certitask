import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, requireRole } from "@/lib/auth";
import { isString } from "@/lib/validation";
import { PROJECT_CATEGORIES, TEAM_CAP_MAX, TEAM_CAP_MIN, TEAM_CAP_DEFAULT, isOneOf } from "@/lib/enums";
import { projectListInclude } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { parseDeadline, parseSkills, rankProjects } from "@/lib/projects";
import { BillingError, consumePost, getEntitlement } from "@/lib/billing";

/**
 * GET /api/projects
 * - Client: their own projects (all statuses).
 * - Anyone else (talent or public): ACTIVE projects with an open deadline.
 */
export async function GET() {
  const session = await getSession();

  try {
    if (session?.role === "CLIENT") {
      const projects = await prisma.project.findMany({
        where: { clientId: session.userId },
        include: projectListInclude,
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ projects });
    }

    const projects = await prisma.project.findMany({
      where: { status: "ACTIVE", deadline: { gte: new Date() } },
      include: projectListInclude,
      orderBy: { publishedAt: "desc" },
    });
    return NextResponse.json({ projects: rankProjects(projects) });
  } catch (error) {
    console.error("Fetch projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}

/**
 * POST /api/projects — client creates a project.
 * A VERIFIED client's project goes ACTIVE immediately; an unverified client's
 * is saved as a DRAFT and can be published once verification is approved.
 * Phase 4 inserts the listing-fee payment before activation.
 */
export async function POST(req: Request) {
  const auth = await requireRole("CLIENT");
  if (auth instanceof NextResponse) return auth;

  try {
    const me = await prisma.user.findUnique({ where: { id: auth.userId }, select: { emailVerifiedAt: true, verificationStatus: true } });
    if (!me?.emailVerifiedAt) {
      return NextResponse.json({ error: "Confirm your email address before posting a project" }, { status: 403 });
    }
    const entitlement = await getEntitlement(auth.userId);
    const canPublish = entitlement.canPost;

    const body = await req.json();
    const { title, description, category, requiredSkills, deliverables, deadline, teamCap, draft } = body;

    if (!isString(title, 200) || !isString(description, 10000) || !isString(deliverables, 10000)) {
      return NextResponse.json({ error: "Title, description and deliverables are required" }, { status: 400 });
    }
    if (!isOneOf(PROJECT_CATEGORIES, category)) {
      return NextResponse.json({ error: "Choose a project category" }, { status: 400 });
    }
    const skills = parseSkills(requiredSkills);
    if (skills.length === 0) {
      return NextResponse.json({ error: "Add at least one required skill" }, { status: 400 });
    }
    const deadlineDate = parseDeadline(deadline);
    if (!deadlineDate || deadlineDate <= new Date()) {
      return NextResponse.json({ error: "Deadline must be a date in the future" }, { status: 400 });
    }
    const cap = teamCap === undefined || teamCap === "" ? TEAM_CAP_DEFAULT : Number(teamCap);
    if (!Number.isInteger(cap) || cap < TEAM_CAP_MIN || cap > TEAM_CAP_MAX) {
      return NextResponse.json({ error: `Team size must be between ${TEAM_CAP_MIN} and ${TEAM_CAP_MAX}` }, { status: 400 });
    }

    const publishNow = canPublish && !draft;
    const project = await prisma.$transaction(async (tx) => {
      const p = await tx.project.create({
        data: {
          clientId: auth.userId,
          title: title.trim(),
          description: description.trim(),
          category,
          requiredSkills: skills,
          deliverables: deliverables.trim(),
          deadline: deadlineDate,
          teamCap: cap,
          status: publishNow ? "ACTIVE" : "DRAFT",
          publishedAt: publishNow ? new Date() : null,
        },
        include: projectListInclude,
      });
      await audit(auth, "project.created", "project", p.id, { title: p.title, status: p.status }, tx);
      if (!publishNow) return p;
      await consumePost(tx, auth.userId, p.id);
      return tx.project.findUniqueOrThrow({ where: { id: p.id }, include: projectListInclude }); // picks up the plan link

    }, { maxWait: 10_000, timeout: 30_000 });

    const notice = publishNow
      ? null
      : draft
        ? "Saved as a draft. Publish it from My Projects whenever you're ready."
        : entitlement.reason === "NOT_VERIFIED"
          ? "Saved as a draft. Once your verification is approved you can publish it from My Projects."
          : entitlement.reason === "PLAN_REQUIRED"
            ? "Saved as a draft. You've used your free posts — choose a plan to publish."
            : "Saved as a draft. Your plan's post limit for this period is used up — upgrade to publish.";

    return NextResponse.json({ success: true, project, notice, billing: entitlement.reason });
  } catch (error) {
    if (error instanceof BillingError) return NextResponse.json({ error: error.message, billing: error.code }, { status: error.status });
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
