import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCertId, signCertificate } from "@/lib/certificates";
import { generateCertificatePdf, loadPrintableCertificate } from "@/lib/pdf";
import { certificatePageUrl, certificateVerifyUrl, linkedInAddUrl } from "@/lib/certificate-links";
import { sendCertificateEmail, sendCertificatesIssuedSummaryEmail } from "@/lib/email";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import type { SessionPayload } from "@/lib/auth-token";

type Tx = Prisma.TransactionClient;
type Actor = SessionPayload | "system";

interface Recipient { id: string; name: string; legalName: string | null; email: string; verificationStatus: string }
interface IssueContext {
  projectId: string;
  title: string;
  skills: string[];
  teamId: string | null;
  submissionId: string | null;
  client: { id: string; name: string; legalName: string | null; clientType: "INDIVIDUAL" | "ORGANIZATION" | null };
}

/** Create one certificate row. Caller guarantees the recipient is VERIFIED and has none for this project. */
async function createCertificate(tx: Tx, actor: Actor, ctx: IssueContext, user: Recipient): Promise<string> {
  const issuedAt = new Date();
  const certId = generateCertId();
  const recipientName = user.legalName || user.name;
  const issuerName = ctx.client.legalName || ctx.client.name;
  const signature = signCertificate({ certId, recipientName, recipientEmail: user.email, issuerName, projectId: ctx.projectId, title: ctx.title, issuedAt });

  const cert = await tx.certificate.create({
    data: {
      certId, talentId: user.id, clientId: ctx.client.id, projectId: ctx.projectId, teamId: ctx.teamId,
      recipientName, recipientEmail: user.email, issuerName, issuerType: ctx.client.clientType ?? "INDIVIDUAL",
      title: ctx.title, skills: ctx.skills, issuedAt, signature,
    },
  });
  await audit(actor, "certificate.issued", "certificate", cert.id, { certId, talentId: user.id, projectId: ctx.projectId }, tx);
  await notify(user.id, "certificate.issued", "Certificate issued 🏅", `Your certificate for "${ctx.title}" from ${issuerName} is ready.`, `/talent/dashboard?tab=certificates`, tx);
  return cert.id;
}

/**
 * On submission approval: issue a certificate to every ACCEPTED member whose
 * identity is VERIFIED; place a hold for the others (issued automatically when
 * their verification is approved). Idempotent per (project, talent).
 */
export async function issueCertificatesForSubmission(
  tx: Tx,
  actor: SessionPayload,
  submissionId: string
): Promise<{ issued: string[]; held: string[] }> {
  const submission = await tx.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: {
      project: { select: { id: true, title: true, requiredSkills: true, client: { select: { id: true, name: true, legalName: true, clientType: true } } } },
      team: { select: { id: true, members: { where: { status: "ACCEPTED" }, select: { user: { select: { id: true, name: true, legalName: true, email: true, verificationStatus: true } } } } } },
    },
  });
  const ctx: IssueContext = {
    projectId: submission.project.id, title: submission.project.title, skills: submission.project.requiredSkills,
    teamId: submission.team.id, submissionId, client: submission.project.client,
  };

  const memberIds = submission.team.members.map((m) => m.user.id);
  const [existingCerts, existingHolds] = await Promise.all([
    tx.certificate.findMany({ where: { projectId: ctx.projectId, talentId: { in: memberIds } }, select: { talentId: true } }),
    tx.certificateHold.findMany({ where: { projectId: ctx.projectId, talentId: { in: memberIds } }, select: { talentId: true } }),
  ]);
  const done = new Set([...existingCerts.map((c) => c.talentId), ...existingHolds.map((h) => h.talentId)]);

  const issued: string[] = [];
  const held: string[] = [];
  for (const { user } of submission.team.members) {
    if (done.has(user.id)) continue;
    if (user.verificationStatus === "VERIFIED") {
      issued.push(await createCertificate(tx, actor, ctx, user));
    } else {
      await tx.certificateHold.create({ data: { projectId: ctx.projectId, talentId: user.id, teamId: ctx.teamId, submissionId, approvedById: actor.userId } });
      await audit(actor, "certificate.held", "user", user.id, { projectId: ctx.projectId, reason: "identity not verified" }, tx);
      await notify(user.id, "certificate.issued", "Certificate waiting for verification", `"${ctx.title}" was approved. Verify your identity to receive the certificate.`, `/talent/dashboard?tab=verification`, tx);
      held.push(user.id);
    }
  }
  return { issued, held };
}

/** When a talent's identity is approved, issue every certificate on hold for them. */
export async function releaseHeldCertificates(tx: Tx, actor: Actor, talentId: string): Promise<string[]> {
  const holds = await tx.certificateHold.findMany({
    where: { talentId },
    include: { project: { select: { id: true, title: true, requiredSkills: true, client: { select: { id: true, name: true, legalName: true, clientType: true } } } } },
  });
  if (holds.length === 0) return [];
  const user = await tx.user.findUniqueOrThrow({ where: { id: talentId }, select: { id: true, name: true, legalName: true, email: true, verificationStatus: true } });

  const issued: string[] = [];
  for (const h of holds) {
    const already = await tx.certificate.findUnique({ where: { projectId_talentId: { projectId: h.projectId, talentId } }, select: { id: true } });
    if (!already) {
      issued.push(await createCertificate(tx, actor, {
        projectId: h.project.id, title: h.project.title, skills: h.project.requiredSkills, teamId: h.teamId, submissionId: h.submissionId, client: h.project.client,
      }, user));
    }
    await tx.certificateHold.delete({ where: { id: h.id } });
  }
  return issued;
}

/**
 * Best-effort PDF + email delivery after the transaction has committed. Never throws.
 * The talent gets the PDF; the issuing client gets one summary email with links
 * (no attachments — they can download any certificate from their dashboard).
 */
export async function deliverCertificates(certificateIds: string[]): Promise<void> {
  const byClient = new Map<string, { clientId: string; title: string; certs: { certId: string; recipientName: string }[] }>();
  for (const id of certificateIds) {
    try {
      const cert = await loadPrintableCertificate({ id });
      if (!cert) continue;
      const pdf = await generateCertificatePdf(cert);
      await sendCertificateEmail({
        to: cert.recipientEmail,
        subject: `Your CertiTask certificate — ${cert.title}`,
        text: `Congratulations ${cert.recipientName}! Your certificate for "${cert.title}" issued by ${cert.issuerName} is attached.\n\nShare it: ${certificatePageUrl(cert.certId)}\nVerify it any time: ${certificateVerifyUrl(cert.certId)}\nAdd it to LinkedIn: ${linkedInAddUrl(cert)}\n\nCertificate ID: ${cert.certId}`,
        html: certificateIssuedHtml(cert),
        attachment: { filename: `${cert.certId}.pdf`, content: pdf },
      });
      const key = `${cert.clientId}:${cert.title}`;
      const group = byClient.get(key) ?? { clientId: cert.clientId, title: cert.title, certs: [] };
      group.certs.push({ certId: cert.certId, recipientName: cert.recipientName });
      byClient.set(key, group);
    } catch (err) {
      console.error("certificate delivery failed:", id, err);
    }
  }
  for (const g of byClient.values()) {
    try {
      const client = await prisma.user.findUnique({ where: { id: g.clientId }, select: { email: true, name: true } });
      if (client) await sendCertificatesIssuedSummaryEmail(client.email, client.name, g.title, g.certs.map(c => ({ ...c, url: certificatePageUrl(c.certId) })));
    } catch (err) {
      console.error("issuer summary email failed:", g.clientId, err);
    }
  }
}

function certificateIssuedHtml(cert: { certId: string; recipientName: string; title: string; issuerName: string; issuedAt: Date }): string {
  const page = certificatePageUrl(cert.certId), verify = certificateVerifyUrl(cert.certId), li = linkedInAddUrl(cert);
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16233A">
  <div style="padding:20px 0;border-bottom:2px solid #0F2A4A"><strong style="font-size:20px;color:#0F2A4A">Certi<span style="color:#C9A227">Task</span></strong></div>
  <h2 style="font-size:20px;margin:24px 0 8px">Congratulations, ${cert.recipientName} 🏅</h2>
  <p>Your certificate for <strong>${cert.title}</strong>, issued by ${cert.issuerName}, is attached as a PDF and live at the link below.</p>
  <p style="margin:24px 0"><a href="${page}" style="background:#0F2A4A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">View certificate</a>
  &nbsp; <a href="${li}" style="background:#0A66C2;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Add to LinkedIn</a></p>
  <p style="font-size:13px;color:#4B5563">Certificate ID <code>${cert.certId}</code> · anyone can check it at <a href="${verify}">${verify}</a> (the QR code on the PDF opens the same page).</p>
  <p style="font-size:12px;color:#7B8794;margin-top:32px">If you didn't expect this email you can ignore it.</p>
</div>`;
}
