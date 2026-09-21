import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { VERIFICATION_STATUSES, isOneOf } from "@/lib/enums";

/** GET /api/admin/verifications?status=PENDING_REVIEW — review queue. */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "PENDING_REVIEW";
  const kind = url.searchParams.get("kind");
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const where = {
    ...(status === "ALL" ? {} : isOneOf(VERIFICATION_STATUSES, status) ? { status } : { status: "PENDING_REVIEW" as const }),
    ...(kind === "IDENTITY" || kind === "ORGANIZATION" ? { kind: kind as "IDENTITY" | "ORGANIZATION" } : {}),
    ...(q ? { user: { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } } : {}),
  };

  try {
    const requests = await prisma.verificationRequest.findMany({
      where,
      select: {
        id: true, kind: true, status: true, formData: true, submittedAt: true, reviewedAt: true, reviewedBy: true, rejectionReason: true,
        user: { select: { id: true, name: true, email: true, role: true, clientType: true, website: true, location: true, createdAt: true, emailVerifiedAt: true } },
        documents: { where: { deletedAt: null }, select: { id: true, type: true, mimeType: true, sizeBytes: true, createdAt: true } },
      },
      orderBy: { submittedAt: status === "PENDING_REVIEW" ? "asc" : "desc" },
      take: 200,
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("Admin verifications error:", error);
    return NextResponse.json({ error: "Failed to load verification requests" }, { status: 500 });
  }
}
