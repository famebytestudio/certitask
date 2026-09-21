import QRCode from "qrcode";
import { appUrl } from "@/lib/email-verification";
import { certificatePagePath, certificateVerifyPath, linkedInAddUrl as linkedInAddUrlFor } from "@/lib/certificate-share";

/** Public, login-free page that shows the live status of a certificate. Printed on the PDF and encoded in its QR. */
export function certificateVerifyUrl(certId: string): string {
  return appUrl() + certificateVerifyPath(certId);
}

/** Shareable certificate page (what the talent posts on LinkedIn / sends to a recruiter). */
export function certificatePageUrl(certId: string): string {
  return appUrl() + certificatePagePath(certId);
}

/**
 * Short, human-checkable form of the HMAC signature. Printed on the certificate so
 * a reader can compare it with what /verify shows for the same ID.
 */
export function signatureFingerprint(signature: string): string {
  return signature.slice(0, 16).toUpperCase().match(/.{1,4}/g)!.join("-");
}

export function certificateQrPng(certId: string): Promise<Buffer> {
  return QRCode.toBuffer(certificateVerifyUrl(certId), { type: "png", errorCorrectionLevel: "M", margin: 1, width: 360, color: { dark: "#0F2A4A", light: "#FFFFFF" } });
}

export function certificateQrDataUrl(certId: string): Promise<string> {
  return QRCode.toDataURL(certificateVerifyUrl(certId), { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#0F2A4A", light: "#FFFFFF" } });
}

/** Server-side LinkedIn deep link (uses APP_URL). */
export function linkedInAddUrl(c: { certId: string; title: string; issuedAt: Date }): string {
  return linkedInAddUrlFor(appUrl(), c);
}
