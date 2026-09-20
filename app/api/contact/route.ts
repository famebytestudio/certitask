import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isEmail, isString } from "@/lib/validation";
import { isRateLimited } from "@/lib/rate-limit";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/billing";

export async function POST(req: Request) {
  try {
    const clientKey = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (await isRateLimited(`contact:${clientKey}`, 5, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many messages. Try again later." }, { status: 429 });
    }

    const { name, email, subject, message, type } = await req.json();

    if (!isString(name, 120) || !isEmail(email) || !isString(message, 10000) ||
      (subject !== undefined && subject !== null && subject !== "" && !isString(subject, 200)) ||
      (type !== undefined && type !== "contact" && type !== "client_query")) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const session = await getSession();
    const priority = session?.role === "CLIENT" ? (await getEntitlement(session.userId)).features.prioritySupport : false;

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name,
        email,
        subject: subject || null,
        message,
        type: type || "contact",
        priority,
      },
    });

    return NextResponse.json({ success: true, id: contactMessage.id });
  } catch (error) {
    console.error("Contact message error:", error);
    return NextResponse.json(
      { error: "Failed to send message. Please try again." },
      { status: 500 }
    );
  }
}
