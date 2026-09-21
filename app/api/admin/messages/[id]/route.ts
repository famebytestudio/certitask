import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/admin/messages/[id] — { read?: boolean, archived?: boolean } */
export async function PATCH(req: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { read?: unknown; archived?: unknown };
  const data: { isRead?: boolean; readAt?: Date | null; archivedAt?: Date | null } = {};
  if (typeof body.read === "boolean") { data.isRead = body.read; data.readAt = body.read ? new Date() : null; }
  if (typeof body.archived === "boolean") data.archivedAt = body.archived ? new Date() : null;
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const message = await prisma.contactMessage.update({ where: { id }, data });
    if (body.archived === true) await audit(authorization, "message.archived", "message", id, {});
    return NextResponse.json({ success: true, message });
  } catch {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
}

/** DELETE /api/admin/messages/[id] */
export async function DELETE(_req: Request, { params }: Params) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;
  const { id } = await params;
  try {
    const m = await prisma.contactMessage.delete({ where: { id } });
    await audit(authorization, "message.deleted", "message", id, { from: m.email, subject: m.subject });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }
}
