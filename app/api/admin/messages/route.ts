import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { paging, searchTerm } from "@/lib/admin";

/** GET /api/admin/messages?box=inbox|unread|archived&q&page — priority (Pro clients) first, then newest. */
export async function GET(req: Request) {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  const url = new URL(req.url);
  const box = url.searchParams.get("box") ?? "inbox";
  const q = searchTerm(url);
  const { page, skip, take } = paging(url);
  const where: Prisma.ContactMessageWhereInput = {
    ...(box === "archived" ? { archivedAt: { not: null } } : { archivedAt: null }),
    ...(box === "unread" ? { isRead: false } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { subject: { contains: q, mode: "insensitive" } }, { message: { contains: q, mode: "insensitive" } }] } : {}),
  };

  try {
    const [total, messages, unread] = await Promise.all([
      prisma.contactMessage.count({ where }),
      prisma.contactMessage.findMany({ where, skip, take, orderBy: [{ priority: "desc" }, { createdAt: "desc" }] }),
      prisma.contactMessage.count({ where: { isRead: false, archivedAt: null } }),
    ]);
    // Link senders to accounts when the email matches, so the admin can jump to them.
    const emails = [...new Set(messages.map(m => m.email.toLowerCase()))];
    const accounts = emails.length ? await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true, email: true, role: true, name: true } }) : [];
    return NextResponse.json({
      messages: messages.map(m => ({ ...m, account: accounts.find(a => a.email.toLowerCase() === m.email.toLowerCase()) ?? null })),
      total, page, pageSize: take, unread,
    });
  } catch (error) {
    console.error("Admin messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
