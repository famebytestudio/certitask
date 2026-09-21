import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { paging, searchTerm } from "@/lib/admin";

/** GET /api/admin/certificates?q&status&page — search by certificate ID, recipient, issuer or project. */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const q = searchTerm(url);
  const status = url.searchParams.get("status");
  const { page, skip, take } = paging(url);
  const where: Prisma.CertificateWhereInput = {
    ...(status && ["VERIFIED", "REVOKED", "DISPUTED"].includes(status) ? { status: status as Prisma.CertificateWhereInput["status"] } : {}),
    ...(q ? { OR: [{ certId: { contains: q.toUpperCase() } }, { recipientName: { contains: q, mode: "insensitive" } }, { recipientEmail: { contains: q, mode: "insensitive" } }, { issuerName: { contains: q, mode: "insensitive" } }, { title: { contains: q, mode: "insensitive" } }] } : {}),
  };
  try {
    const [total, certificates] = await Promise.all([
      prisma.certificate.count({ where }),
      prisma.certificate.findMany({
        where, skip, take, orderBy: { issuedAt: "desc" },
        select: { id: true, certId: true, title: true, recipientName: true, recipientEmail: true, issuerName: true, issuerType: true, status: true, statusReason: true, statusChangedAt: true, issuedAt: true, skills: true, talentId: true, clientId: true, projectId: true },
      }),
    ]);
    return NextResponse.json({ certificates, total, page, pageSize: take });
  } catch (error) {
    console.error("Admin certificates error:", error);
    return NextResponse.json({ error: "Failed to fetch certificates" }, { status: 500 });
  }
}
