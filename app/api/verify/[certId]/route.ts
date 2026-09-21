import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited } from "@/lib/rate-limit";
import { verifyCertificateSignature } from "@/lib/certificates";
import { signatureFingerprint } from "@/lib/certificate-links";

type Params = { params: Promise<{ certId: string }> };

/**
 * GET /api/verify/[certId] — public, login-free verification (FR-V3).
 * Returns only what a recruiter needs; never emails or internal ids.
 */
export async function GET(req: Request, { params }: Params) {
  try {
    const clientKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (await isRateLimited(`verify:${clientKey}`, 120, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many verification requests. Try again later." }, { status: 429 });
    }

    const { certId } = await params;
    const certificate = await prisma.certificate.findUnique({
      where: { certId: certId.trim().toUpperCase() },
      include: {
        client: { select: { id: true, name: true, avatarUrl: true, website: true, verificationStatus: true } },
        project: { select: { id: true, title: true, category: true } },
      },
    });
    if (!certificate) return NextResponse.json({ error: "Certificate not found" }, { status: 404 });

    const signatureValid = verifyCertificateSignature(
      {
        certId: certificate.certId,
        recipientName: certificate.recipientName,
        recipientEmail: certificate.recipientEmail,
        issuerName: certificate.issuerName,
        projectId: certificate.projectId,
        title: certificate.title,
        issuedAt: certificate.issuedAt,
      },
      certificate.signature
    );

    return NextResponse.json({
      certificate: {
        certId: certificate.certId,
        title: certificate.title,
        recipientName: certificate.recipientName,
        issuerName: certificate.issuerName,
        issuerType: certificate.issuerType,
        skills: certificate.skills,
        issuedAt: certificate.issuedAt,
        status: certificate.status,
        statusReason: certificate.status === "VERIFIED" ? null : certificate.statusReason,
        signatureValid,
        fingerprint: signatureFingerprint(certificate.signature),
        client: certificate.client,
        project: certificate.project,
      },
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
