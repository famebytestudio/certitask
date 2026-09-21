import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { generateCertificatePdf, loadPrintableCertificate } from "@/lib/pdf";

type Params = { params: Promise<{ id: string }> };

/** GET /api/certificates/[id]/pdf — the recipient, the issuer or an admin downloads the PDF. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireRole("CLIENT", "TALENT", "ADMIN");
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const certificate = await loadPrintableCertificate(id.toUpperCase().startsWith("CERT-") ? { certId: id.toUpperCase() } : { id });
  if (!certificate) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const allowed =
    auth.role === "ADMIN" ||
    (auth.role === "TALENT" && certificate.talentId === auth.userId) ||
    (auth.role === "CLIENT" && certificate.clientId === auth.userId);
  if (!allowed) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A revoked certificate must not be reproduced as a clean PDF.
  if (certificate.status === "REVOKED") {
    return NextResponse.json({ error: "This certificate has been revoked" }, { status: 410 });
  }

  try {
    const pdf = await generateCertificatePdf(certificate);
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${certificate.certId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
