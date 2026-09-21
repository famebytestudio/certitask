import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { searchTerm } from "@/lib/admin";

/** GET /api/admin/search?q — global search across users, projects and certificates (top 5 each). */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const q = searchTerm(new URL(req.url));
  if (!q || q.length < 2) return NextResponse.json({ users: [], projects: [], certificates: [] });
  try {
    const [users, projects, certificates] = await Promise.all([
      prisma.user.findMany({ where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }, take: 5, select: { id: true, name: true, email: true, role: true, verificationStatus: true, suspendedAt: true } }),
      prisma.project.findMany({ where: { title: { contains: q, mode: "insensitive" } }, take: 5, select: { id: true, title: true, status: true, client: { select: { name: true } } } }),
      prisma.certificate.findMany({ where: { OR: [{ certId: { contains: q.toUpperCase() } }, { recipientName: { contains: q, mode: "insensitive" } }] }, take: 5, select: { id: true, certId: true, recipientName: true, title: true, status: true } }),
    ]);
    return NextResponse.json({ users, projects, certificates });
  } catch (error) {
    console.error("Admin search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
