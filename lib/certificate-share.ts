/** Client-safe URL builders for sharing a certificate (no Node or env access). */

export function certificateVerifyPath(certId: string): string {
  return `/verify/${encodeURIComponent(certId)}`;
}

export function certificatePagePath(certId: string): string {
  return `/certificates/${encodeURIComponent(certId)}`;
}

/**
 * LinkedIn's "Add to profile" deep link (the only integration LinkedIn offers
 * without a partner API). Opens the certification form pre-filled.
 */
export function linkedInAddUrl(base: string, c: { certId: string; title: string; issuedAt: Date }): string {
  const q = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: `${c.title} — CertiTask verified project`,
    organizationName: "CertiTask",
    issueYear: String(c.issuedAt.getUTCFullYear()),
    issueMonth: String(c.issuedAt.getUTCMonth() + 1),
    certUrl: `${base.replace(/\/$/, "")}${certificatePagePath(c.certId)}`,
    certId: c.certId,
  });
  return `https://www.linkedin.com/profile/add?${q.toString()}`;
}
