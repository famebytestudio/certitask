import nodemailer from "nodemailer";

interface SendOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachment?: { filename: string; content: Buffer };
}

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transporter() {
  const port = Number(process.env.SMTP_PORT);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const FROM = () => process.env.EMAIL_FROM || process.env.SMTP_USER || "no-reply@certitask.local";

/**
 * Send an email. When SMTP is not configured (local dev) the message is
 * printed to the server console instead so links can still be followed.
 */
export async function sendEmail(opts: SendOptions): Promise<{ sent: boolean }> {
  if (!isSmtpConfigured()) {
    console.log(`\n[email:dev] To: ${opts.to}\n[email:dev] Subject: ${opts.subject}\n${opts.text}\n`);
    return { sent: false };
  }
  await transporter().sendMail({
    from: FROM(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    attachments: opts.attachment ? [{ filename: opts.attachment.filename, content: opts.attachment.content }] : [],
  });
  return { sent: true };
}

/* ── Templates ── */

const layout = (title: string, bodyHtml: string) => `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#16233A">
  <div style="padding:20px 0;border-bottom:2px solid #0F2A4A"><strong style="font-size:20px;color:#0F2A4A">Certi<span style="color:#C9A227">Task</span></strong></div>
  <h2 style="font-size:20px;margin:24px 0 8px">${title}</h2>
  ${bodyHtml}
  <p style="font-size:12px;color:#7B8794;margin-top:32px">If you didn't expect this email you can ignore it.</p>
</div>`;

const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#0F2A4A;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">${label}</a></p><p style="font-size:12px;color:#7B8794;word-break:break-all">Or copy this link: ${href}</p>`;

export function sendCertificateEmail(opts: SendOptions) {
  return sendEmail(opts);
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendEmail({
    to,
    subject: "Reset your CertiTask password",
    text: `Use this link to reset your CertiTask password. It expires in 15 minutes and can only be used once:\n\n${resetUrl}`,
    html: layout("Reset your password", `<p>Use the button below to choose a new password. The link expires in 15 minutes and works once.</p>${button(resetUrl, "Reset password")}`),
  });
}

export function sendVerifyEmailEmail(to: string, name: string, verifyUrl: string) {
  return sendEmail({
    to,
    subject: "Confirm your email for CertiTask",
    text: `Hi ${name},\n\nConfirm your email address to start applying to projects (or posting them):\n\n${verifyUrl}\n\nThe link expires in 24 hours.`,
    html: layout("Confirm your email", `<p>Hi ${name},</p><p>Confirm your email address to start applying to projects, or posting them. The link expires in 24 hours.</p>${button(verifyUrl, "Confirm email")}`),
  });
}

export function sendVerificationDecisionEmail(to: string, name: string, approved: boolean, reason: string | null, dashboardUrl: string) {
  const subject = approved ? "Your CertiTask verification was approved" : "Your CertiTask verification needs another look";
  const text = approved
    ? `Hi ${name},\n\nYour identity/organization verification has been approved. Your profile now shows a Verified badge and certificates can be issued in your legal name.\n\n${dashboardUrl}`
    : `Hi ${name},\n\nWe couldn't approve your verification yet.\n\nReason: ${reason ?? "not specified"}\n\nYou can fix the issue and resubmit from your dashboard:\n${dashboardUrl}`;
  const html = approved
    ? layout("You're verified ✓", `<p>Hi ${name},</p><p>Your verification has been approved. Your profile now shows a <strong>Verified</strong> badge and certificates can be issued in your legal name.</p>${button(dashboardUrl, "Open dashboard")}`)
    : layout("Verification not approved yet", `<p>Hi ${name},</p><p>We couldn't approve your verification yet.</p><p style="padding:12px;background:#FBE9E9;border-radius:8px"><strong>Reason:</strong> ${reason ?? "not specified"}</p><p>Fix the issue and resubmit from your dashboard.</p>${button(dashboardUrl, "Resubmit")}`);
  return sendEmail({ to, subject, text, html });
}

export function sendTeamInviteEmail(to: string, recipientName: string | null, leadName: string, teamName: string, projectTitle: string, url: string, hasAccount: boolean) {
  const greet = recipientName ? `Hi ${recipientName},` : "Hi,";
  const action = hasAccount ? "Open your dashboard to accept or decline." : "Create a free talent account with this email address and the invitation will be waiting for you.";
  return sendEmail({
    to,
    subject: `${leadName} invited you to a team on CertiTask`,
    text: `${greet}

${leadName} invited you to join the team "${teamName}" for the project "${projectTitle}" on CertiTask. ${action}

${url}

The invitation expires in 7 days.`,
    html: layout(`You're invited to "${teamName}"`, `<p>${greet}</p><p><strong>${leadName}</strong> invited you to join the team <strong>${teamName}</strong> for the project <strong>${projectTitle}</strong>.</p><p>${action}</p>${button(url, hasAccount ? "View invitation" : "Sign up and join")}<p style="font-size:12px;color:#7B8794">The invitation expires in 7 days.</p>`),
  });
}

export function sendDeadlineReminderEmail(to: string, name: string, projectTitle: string, deadline: Date, url: string) {
  const when = deadline.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  return sendEmail({
    to,
    subject: `Reminder: "${projectTitle}" is due ${when}`,
    text: `Hi ${name},

Your team's submission for "${projectTitle}" is due on ${when}. Submit your deliverables from your dashboard:

${url}`,
    html: layout("Deadline in 3 days", `<p>Hi ${name},</p><p>Your team's submission for <strong>${projectTitle}</strong> is due on <strong>${when}</strong>.</p>${button(url, "Submit deliverables")}`),
  });
}

export function sendReceiptEmail(to: string, name: string, planName: string, amount: string, receiptNumber: string, billingUrl: string) {
  return sendEmail({
    to,
    subject: `Receipt ${receiptNumber} — CertiTask ${planName} plan`,
    text: `Hi ${name},

Thanks for your payment of ${amount} for the CertiTask ${planName} plan (30 days). Receipt number: ${receiptNumber}.

Download the receipt and manage your plan here:
${billingUrl}`,
    html: layout("Payment received", `<p>Hi ${name},</p><p>Thanks for your payment of <strong>${amount}</strong> for the <strong>${planName}</strong> plan (30 days).</p><p>Receipt number: <strong>${receiptNumber}</strong></p>${button(billingUrl, "View billing")}`),
  });
}
