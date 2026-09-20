import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  const authorization = await requireAdmin();
  if (authorization instanceof NextResponse) return authorization;

  try {
    const messages = await prisma.contactMessage.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Admin messages error:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}
