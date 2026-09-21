import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { isString } from "@/lib/validation";
import { certificateInclude } from "@/lib/queries";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sendCertificateStatusEmail } from "@/lib/email";
import { certificatePageUrl } from "@/lib/certificate-links";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/certificates/[id] — the issuing client (or admin) changes status.
 * REVOKED and DISPUTED require a reason (FR-C9, FR-V4). Reinstating to VERIFIED
 * is allowed from DISPUTED only; a revocation is final.
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireRole("CLIENT", "ADMIN");
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { status, reason } = await req.json();

    if (!["VERIFIED", "REVOKED", "DISPUTED"].includes(status)) {
      return NextResponse.json({ error: "Status must be VERIFIED, REVOKED or DISPUTED" }, { status: 400 });
    }
    if (status !== "VERIFIED" && !isString(reason, 1000)) {
      return NextResponse.json({ error: "A reason is required" }, { status: 400 });
    }

    const certificate = await prisma.certificate.findFirst({
      where: auth.role === "ADMIN" ? { OR: [{ id }, { certId: id }] } : { OR: [{ id }, { certId: id }], clientId: auth.userId },
    });
    if (!certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

    if (certificate.status === "REVOKED") {
      return NextResponse.json({ error: "A revoked certificate cannot be changed" }, { status: 409 });
    }
    if (certificate.status === status) {
      return NextResponse.json({ error: `Certificate is already ${status.toLowerCase()}` }, { status: 409 });
    }

    const updated = await prisma.certificate.update({
      where: { id: certificate.id },
      data: { status, statusReason: status === "VERIFIED" ? null : String(reason).trim(), statusChangedAt: new Date() },
      include: certificateInclude,
    });
    await audit(auth, `certificate.${status.toLowerCase()}`, "certificate", certificate.id, { certId: certificate.certId, from: certificate.status, reason: reason ?? null });
    await notify(certificate.talentId, "certificate.status", `Certificate ${status.toLowerCase()}`, `${certificate.title} (${certificate.certId}) is now ${status.toLowerCase()}.${reason ? ` Reason: ${reason}` : ""}`, "/talent/dashboard?tab=certificates");
    void sendCertificateStatusEmail(certificate.recipientEmail, certificate.recipientName, certificate.title, certificate.certId, status, reason ?? null, certificatePageUrl(certificate.certId)).catch(e => console.error("certificate status email failed:", e));

    return NextResponse.json({ success: true, certificate: updated });
  } catch (error) {
    console.error("Update certificate status error:", error);
    return NextResponse.json({ error: "Failed to update certificate" }, { status: 500 });
  }
}
