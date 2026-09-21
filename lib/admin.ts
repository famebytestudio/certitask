/** Small helpers shared by the admin API routes: paging, search terms, CSV. */

export const PAGE_SIZE = 25;

export function paging(url: URL): { page: number; skip: number; take: number } {
  const page = Math.max(1, Math.min(10_000, parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const take = Math.max(5, Math.min(100, parseInt(url.searchParams.get("limit") ?? String(PAGE_SIZE), 10) || PAGE_SIZE));
  return { page, skip: (page - 1) * take, take };
}

export function searchTerm(url: URL): string | null {
  const q = (url.searchParams.get("q") ?? "").trim();
  return q.length > 0 ? q.slice(0, 100) : null;
}

/** Actions in the audit log that deserve a human label in the admin UI. */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  "user.signup": "Signed up",
  "user.email_verified": "Email confirmed",
  "user.suspended": "Account suspended",
  "user.unsuspended": "Account reinstated",
  "user.renamed": "Account renamed",
  "user.deleted": "Account deleted",
  "user.sessions_revoked": "Signed out everywhere",
  "user.verification_email_resent": "Confirmation email resent",
  "verification.submitted": "Verification submitted",
  "verification.approved": "Verification approved",
  "verification.rejected": "Verification rejected",
  "verification.reset": "Verification reset by admin",
  "verification.duplicate_id_attempt": "Duplicate ID attempted",
  "documents.purged": "Verification documents purged",
  "project.created": "Project created",
  "project.updated": "Project updated",
  "project.status_changed": "Project status changed",
  "project.admin_updated": "Project edited by admin",
  "project.deleted": "Project deleted",
  "project.auto_closed": "Project auto-closed",
  "team.created": "Team created",
  "team.member_invited": "Team member invited",
  "team.email_invited": "Invited by email",
  "team.invite_accepted": "Team invite accepted",
  "team.invite_declined": "Team invite declined",
  "team.member_removed": "Team member removed",
  "team.member_left": "Left team",
  "team.disbanded": "Team disbanded",
  "application.submitted": "Application submitted",
  "application.status_changed": "Application decided",
  "application.withdrawn": "Application withdrawn",
  "submission.created": "Work submitted",
  "submission.resubmitted": "Work resubmitted",
  "submission.approved": "Submission approved",
  "submission.rejected": "Changes requested",
  "certificate.issued": "Certificate issued",
  "certificate.held": "Certificate held (unverified member)",
  "certificate.revoked": "Certificate revoked",
  "certificate.disputed": "Certificate disputed",
  "certificate.verified": "Certificate reinstated",
  "billing.checkout_started": "Checkout started",
  "billing.payment_succeeded": "Payment succeeded",
  "billing.activated": "Plan activated",
  "billing.cancelled": "Plan reminders stopped",
  "billing.expired": "Plan expired",
  "billing.refunded": "Payment refunded",
  "billing.webhook_rejected": "Webhook rejected (bad signature)",
  "billing.amount_mismatch": "Payment amount mismatch",
  "message.archived": "Message archived",
  "message.deleted": "Message deleted",
};

/** Fallback for actions not in the table: "team.member_invited" -> "Team member invited". */
export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, c => c.toUpperCase());
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => { const s = v === null || v === undefined ? "" : v instanceof Date ? v.toISOString() : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}
