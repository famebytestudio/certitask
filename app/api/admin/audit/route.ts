import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { AUDIT_ACTION_LABEL, auditLabel, paging, searchTerm } from "@/lib/admin";

/** GET /api/admin/audit?q&action&role&entity&page — who did what, newest first. */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const q = searchTerm(url);
  const action = url.searchParams.get("action");
  const role = url.searchParams.get("role");
  const entity = url.searchParams.get("entity");
  const { page, skip, take } = paging(url);
  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: action.includes(".") ? action : { startsWith: `${action}.` } } : {}),
    ...(role && ["ADMIN", "CLIENT", "TALENT", "SYSTEM"].includes(role) ? { actorRole: role } : {}),
    ...(entity ? { entityType: entity } : {}),
    ...(q ? { OR: [{ entityId: { contains: q } }, { actorId: { contains: q } }, { action: { contains: q } }] } : {}),
  };

  try {
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, skip, take, orderBy: { createdAt: "desc" } }),
    ]);
    const actorIds = [...new Set(rows.map(r => r.actorId).filter((x): x is string => !!x && x !== "super-admin"))];
    const actors = actorIds.length ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }) : [];
    const entries = rows.map(r => ({
      ...r,
      label: auditLabel(r.action),
      actor: r.actorRole === "SYSTEM" ? { name: "System" } : r.actorId === "super-admin" || r.actorRole === "ADMIN" ? { name: "Admin" } : actors.find(a => a.id === r.actorId) ?? { name: "Deleted user" },
    }));
    return NextResponse.json({ entries, total, page, pageSize: take, actions: Object.keys(AUDIT_ACTION_LABEL) });
  } catch (error) {
    console.error("Admin audit error:", error);
    return NextResponse.json({ error: "Failed to fetch audit log" }, { status: 500 });
  }
}
