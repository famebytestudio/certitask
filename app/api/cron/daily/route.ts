import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sendDeadlineReminderEmail } from "@/lib/email";
import { appUrl } from "@/lib/email-verification";
import { runBillingMaintenance } from "@/lib/billing";

const REMINDER_DAYS = 3;

/**
 * GET /api/cron/daily  (Authorization: Bearer $CRON_SECRET) — run once a day.
 *  1. Expire team invitations past their expiry.
 *  2. Close ACTIVE projects whose deadline has passed.
 *  3. Remind SELECTED teams that haven't submitted, 3 days before the deadline.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const now = new Date();

  // 0. sessions: drop rows that can never be used again (expired or revoked for a week)
  const prunedSessions = await prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } }, { revokedAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } }] } });

  // 1. invitations
  const expiredMembers = await prisma.teamMember.updateMany({ where: { status: "INVITED", expiresAt: { lt: now } }, data: { status: "EXPIRED" } });
  const expiredInvites = await prisma.teamInvite.deleteMany({ where: { acceptedAt: null, expiresAt: { lt: now } } });

  // 2. auto-close
  const toClose = await prisma.project.findMany({ where: { status: "ACTIVE", deadline: { lt: now } }, select: { id: true, title: true, clientId: true } });
  for (const p of toClose) {
    await prisma.project.update({ where: { id: p.id }, data: { status: "CLOSED", closedAt: now } });
    await audit("system", "project.auto_closed", "project", p.id, { title: p.title });
    await notify(p.clientId, "submission.reviewed", `"${p.title}" reached its deadline`, "The project is now closed to new applications. Submissions already sent can still be reviewed.", "/client/dashboard?tab=submissions");
  }

  // 3. reminders
  const soon = new Date(now.getTime() + REMINDER_DAYS * 86_400_000);
  const teams = await prisma.team.findMany({
    where: {
      reminderSentAt: null,
      submission: null,
      application: { status: "SELECTED" },
      project: { status: "ACTIVE", deadline: { gt: now, lte: soon } },
    },
    include: {
      project: { select: { id: true, title: true, deadline: true } },
      members: { where: { status: "ACCEPTED" }, select: { user: { select: { id: true, name: true, email: true } } } },
    },
  });
  let reminded = 0;
  for (const t of teams) {
    for (const { user } of t.members) {
      await notify(user.id, "deadline.reminder", `Due in ${REMINDER_DAYS} days: ${t.project.title}`, "Your team hasn't submitted yet. Submit your deliverables before the deadline.", "/talent/dashboard?tab=submissions");
      void sendDeadlineReminderEmail(user.email, user.name, t.project.title, t.project.deadline, `${appUrl()}/talent/dashboard?tab=submissions`).catch((e) => console.error("reminder email failed", e));
    }
    await prisma.team.update({ where: { id: t.id }, data: { reminderSentAt: now } });
    reminded++;
  }

  // 4. billing periods
  const billing = await runBillingMaintenance();

  return NextResponse.json({ prunedSessions: prunedSessions.count, expiredInvitations: expiredMembers.count + expiredInvites.count, closedProjects: toClose.length, remindedTeams: reminded, billing });
}
