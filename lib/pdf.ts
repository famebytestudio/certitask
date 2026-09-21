import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, Color } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";
import { CLIENT_TYPE_LABEL } from "./enums";
import { logoBase64 } from "./logoBase64";
import { certificateQrPng, certificateVerifyUrl, signatureFingerprint } from "./certificate-links";
import { prisma } from "./prisma";

function hexToRgb(hex: string) {
  hex = hex.replace(/^#/, "");
  return rgb(parseInt(hex.substring(0, 2), 16) / 255, parseInt(hex.substring(2, 4), 16) / 255, parseInt(hex.substring(4, 6), 16) / 255);
}

export interface PrintableCertificate {
  certId: string;
  title: string;
  recipientName: string;
  issuerName: string;
  issuerType: "INDIVIDUAL" | "ORGANIZATION";
  skills: string[];
  issuedAt: Date;
  signature: string;
  /** Optional team context, printed under the project title. */
  teamName?: string | null;
  teamRole?: "LEAD" | "MEMBER" | null;
}

/** Load a certificate row plus the recipient's team role for printing. */
export async function loadPrintableCertificate(where: { id: string } | { certId: string }): Promise<(PrintableCertificate & { id: string; talentId: string; clientId: string; status: string; recipientEmail: string }) | null> {
  const cert = await prisma.certificate.findUnique({ where, include: { team: { select: { name: true, members: { select: { userId: true, role: true } } } } } });
  if (!cert) return null;
  const membership = cert.team?.members.find(m => m.userId === cert.talentId);
  return {
    id: cert.id, talentId: cert.talentId, clientId: cert.clientId, status: cert.status, recipientEmail: cert.recipientEmail,
    certId: cert.certId, title: cert.title, recipientName: cert.recipientName, issuerName: cert.issuerName, issuerType: cert.issuerType,
    skills: cert.skills, issuedAt: cert.issuedAt, signature: cert.signature,
    teamName: cert.team?.name ?? null, teamRole: membership?.role ?? null,
  };
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Shrink a font size until the text fits the given width. */
function fitSize(font: PDFFont, text: string, size: number, maxWidth: number): number {
  while (size > 8 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  return size;
}

/**
 * Landscape A4 certificate. Integrity comes from the HMAC signature, not from a
 * picture of a signature: the fingerprint printed here must match what
 * /verify/<certId> shows, and the QR code takes the reader straight there.
 * An optional human signatory (public/signature.png + CERTIFICATE_SIGNATORY_NAME
 * and CERTIFICATE_SIGNATORY_TITLE in env) is drawn only when both are configured.
 */
export async function generateCertificatePdf(certificate: PrintableCertificate): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(`CertiTask certificate ${certificate.certId}`);
  doc.setAuthor("CertiTask");
  doc.setSubject(`${certificate.recipientName} — ${certificate.title}`);
  doc.setKeywords([certificate.certId, "CertiTask", "certificate"]);

  const width = 841.89, height = 595.28;
  const page = doc.addPage([width, height]);

  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvObl = await doc.embedFont(StandardFonts.HelveticaOblique);
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const timesBoldItalic = await doc.embedFont(StandardFonts.TimesRomanBoldItalic);
  const mono = await doc.embedFont(StandardFonts.Courier);

  const navy = hexToRgb("0F2A4A"), gold = hexToRgb("C9A227"), gray = hexToRgb("4B5563"), light = hexToRgb("9CA3AF"), pale = hexToRgb("F3F4F6");

  // Frame
  page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderWidth: 4, borderColor: navy });
  page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderWidth: 1.5, borderColor: gold });

  const centered = (p: PDFPage, text: string, font: PDFFont, size: number, yFromTop: number, color: Color) => {
    const w = font.widthOfTextAtSize(text, size);
    p.drawText(text, { x: (width - w) / 2, y: height - yFromTop, size, font, color });
  };

  // Logo + brand
  const logo = await doc.embedPng(Buffer.from(logoBase64, "base64"));
  const logoDims = logo.scale(0.32);
  page.drawImage(logo, { x: width / 2 - logoDims.width / 2, y: height - 38 - logoDims.height, width: logoDims.width, height: logoDims.height });
  centered(page, "CERTITASK", helvBold, 12, 92, navy);
  centered(page, "Verified project credential", helv, 9, 104, light);

  // Heading
  centered(page, "CERTIFICATE", timesBold, 42, 146, navy);
  centered(page, "OF COMPLETION", times, 16, 168, gold);

  // Recipient
  centered(page, "This is to certify that", helvObl, 13, 204, gray);
  const nameSize = fitSize(timesBoldItalic, certificate.recipientName, 38, width - 200);
  centered(page, certificate.recipientName, timesBoldItalic, nameSize, 250, navy);
  const nameW = timesBoldItalic.widthOfTextAtSize(certificate.recipientName, nameSize);
  page.drawLine({ start: { x: (width - nameW) / 2 - 30, y: height - 262 }, end: { x: (width + nameW) / 2 + 30, y: height - 262 }, thickness: 1, color: gold });

  // Project
  centered(page, "has successfully completed the project", helv, 13, 292, gray);
  const titleSize = fitSize(helvBold, certificate.title, 21, width - 160);
  centered(page, certificate.title, helvBold, titleSize, 322, navy);
  centered(page, `for ${certificate.issuerName}  ·  Verified ${CLIENT_TYPE_LABEL[certificate.issuerType]}`, helv, 12, 344, gray);
  let cursor = 344;
  if (certificate.teamName && certificate.teamName.trim().toLowerCase() !== certificate.recipientName.trim().toLowerCase()) { // solo "teams" carry the person's own name
    cursor += 18;
    const role = certificate.teamRole === "LEAD" ? "as team lead of" : "as a member of";
    centered(page, `${role} "${certificate.teamName}"`, helvObl, 11, cursor, gray);
  }
  if (certificate.skills.length > 0) {
    cursor += 20;
    const skills = `Skills demonstrated: ${certificate.skills.slice(0, 8).join("  ·  ")}`;
    centered(page, skills, helv, fitSize(helv, skills, 10.5, width - 160), cursor, light);
  }

  /* ── Footer band: date & id | QR | signature block ── */
  const bandTop = height - 418; // y of the band's top edge (PDF coords)
  page.drawLine({ start: { x: 70, y: bandTop }, end: { x: width - 70, y: bandTop }, thickness: 0.75, color: pale });

  // Left: issue date + id + verify URL
  const lx = 78;
  page.drawText("ISSUED", { x: lx, y: bandTop - 24, size: 8, font: helvBold, color: light });
  page.drawText(formatDate(certificate.issuedAt), { x: lx, y: bandTop - 40, size: 12, font: helvBold, color: navy });
  page.drawText("CERTIFICATE ID", { x: lx, y: bandTop - 62, size: 8, font: helvBold, color: light });
  page.drawText(certificate.certId, { x: lx, y: bandTop - 78, size: 12, font: mono, color: navy });
  page.drawText("VERIFY AT", { x: lx, y: bandTop - 100, size: 8, font: helvBold, color: light });
  const verifyUrl = certificateVerifyUrl(certificate.certId).replace(/^https?:\/\//, "");
  page.drawText(verifyUrl, { x: lx, y: bandTop - 114, size: fitSize(helv, verifyUrl, 9.5, 230), font: helv, color: gray });

  // Center: QR code
  const qr = await doc.embedPng(await certificateQrPng(certificate.certId));
  const qrSize = 90;
  const qrY = bandTop - 14 - qrSize;
  page.drawImage(qr, { x: width / 2 - qrSize / 2, y: qrY, width: qrSize, height: qrSize });
  centered(page, "Scan to verify", helv, 8, height - qrY + 12, light);

  // Right: signature block
  const rx = width - 78; // right edge
  const rightText = (text: string, font: PDFFont, size: number, y: number, color: Color) => {
    page.drawText(text, { x: rx - font.widthOfTextAtSize(text, size), y, size, font, color });
  };
  rightText("ISSUED BY", helvBold, 8, bandTop - 24, light);
  rightText(certificate.issuerName, helvBold, fitSize(helvBold, certificate.issuerName, 12, 250), bandTop - 40, navy);

  // Optional human signatory, only when explicitly configured.
  const signatoryName = process.env.CERTIFICATE_SIGNATORY_NAME;
  let signatoryDrawn = false;
  if (signatoryName) {
    try {
      const img = await doc.embedPng(await fs.readFile(path.join(process.cwd(), "public", "signature.png")));
      const s = Math.min(120 / img.width, 34 / img.height);
      page.drawImage(img, { x: rx - img.width * s, y: bandTop - 84, width: img.width * s, height: img.height * s });
      rightText(signatoryName, helvBold, 9.5, bandTop - 96, navy);
      rightText(process.env.CERTIFICATE_SIGNATORY_TITLE || "Authorized signatory, CertiTask", helv, 8, bandTop - 107, gray);
      signatoryDrawn = true;
    } catch { /* image missing: fall through to the digital block only */ }
  }
  const sigY = signatoryDrawn ? bandTop - 126 : bandTop - 66;
  rightText("DIGITALLY SIGNED BY CERTITASK", helvBold, 8, sigY, light);
  rightText(`Fingerprint ${signatureFingerprint(certificate.signature)}`, mono, 10, sigY - 15, navy);
  rightText("HMAC-SHA256 · must match the fingerprint shown at the verify link", helv, 7.5, sigY - 27, light);

  // Bottom note
  centered(page, "Recipient identity was verified against a government ID. This certificate is valid only while the verify link reports it as Verified.", helvObl, 7.5, height - 40, light);

  return Buffer.from(await doc.save());
}
