import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { PROJECT_STATUSES, isOneOf } from "@/lib/enums";
import { paging, searchTerm } from "@/lib/admin";

/** GET /api/admin/projects?q&status&featured=1&page — paginated, searchable by title or client. */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const q = searchTerm(url);
  const status = url.searchParams.get("status");
  const featured = url.searchParams.get("featured");
  const { page, skip, take } = paging(url);

  const where: Prisma.ProjectWhereInput = {
    ...(isOneOf(PROJECT_STATUSES, status) ? { status } : {}),
    ...(featured === "1" ? { featured: true } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { client: { name: { contains: q, mode: "insensitive" } } }, { client: { email: { contains: q, mode: "insensitive" } } }] } : {}),
  };

  try {
    const [total, projects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where, skip, take, orderBy: { createdAt: "desc" },
        select: {
          id: true, title: true, category: true, status: true, featured: true, viewCount: true, deadline: true, createdAt: true, publishedAt: true, teamCap: true,
          client: { select: { id: true, name: true, email: true, clientType: true } },
          subscription: { select: { plan: true } },
          _count: { select: { applications: true, submissions: true, certificates: true, teams: true } },
        },
      }),
    ]);
    return NextResponse.json({ projects, total, page, pageSize: take });
  } catch (error) {
    console.error("Admin projects error:", error);
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
  }
}
