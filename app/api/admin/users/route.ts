import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { paging, searchTerm } from "@/lib/admin";

/**
 * GET /api/admin/users?q&role=CLIENT|TALENT&verified=VERIFIED|PENDING_REVIEW|UNVERIFIED|REJECTED&suspended=1&sort=newest|oldest|name&page
 * One paginated list for both roles; the UI filters by role.
 */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const q = searchTerm(url);
  const role = url.searchParams.get("role");
  const verified = url.searchParams.get("verified");
  const suspended = url.searchParams.get("suspended");
  const sort = url.searchParams.get("sort") ?? "newest";
  const { page, skip, take } = paging(url);

  const where: Prisma.UserWhereInput = {
    ...(role === "CLIENT" || role === "TALENT" ? { role } : {}),
    ...(verified && ["VERIFIED", "PENDING_REVIEW", "UNVERIFIED", "REJECTED"].includes(verified) ? { verificationStatus: verified as Prisma.UserWhereInput["verificationStatus"] } : {}),
    ...(suspended === "1" ? { suspendedAt: { not: null } } : suspended === "0" ? { suspendedAt: null } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { legalName: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const orderBy: Prisma.UserOrderByWithRelationInput = sort === "oldest" ? { createdAt: "asc" } : sort === "name" ? { name: "asc" } : { createdAt: "desc" };

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where, orderBy, skip, take,
        select: {
          id: true, name: true, email: true, role: true, clientType: true, verificationStatus: true, emailVerifiedAt: true,
          suspendedAt: true, createdAt: true, location: true, universityName: true, freePostsUsed: true,
          _count: { select: { projectsPosted: true, certificatesIssued: true, teamMemberships: true, certificatesEarned: true } },
          subscriptions: { where: { status: "ACTIVE", periodEnd: { gt: new Date() } }, select: { plan: true }, take: 1 },
        },
      }),
    ]);
    return NextResponse.json({ users: users.map(u => ({ ...u, plan: u.subscriptions[0]?.plan ?? null, subscriptions: undefined })), total, page, pageSize: take });
  } catch (error) {
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
