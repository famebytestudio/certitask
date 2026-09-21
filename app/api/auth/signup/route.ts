import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken, setAuthCookie } from "@/lib/auth";
import { isEmail, isString } from "@/lib/validation";
import { getClientRateLimitKey, isRateLimited } from "@/lib/rate-limit";
import { CLIENT_TYPES, isOneOf } from "@/lib/enums";
import { audit } from "@/lib/audit";
import { sendEmailVerification } from "@/lib/email-verification";
import { attachPendingInvites } from "@/lib/teams";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const { email, password, fullName, role, clientType } = payload;
    const clientKey = getClientRateLimitKey(req, "signup", String(email ?? ""));

    if (await isRateLimited(clientKey, 5, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many signup attempts. Try again later." }, { status: 429 });
    }

    if (!isEmail(email) || !isString(password, 128) || password.length < 8 || !isString(fullName, 120)) {
      return NextResponse.json(
        { error: "Enter a valid email, a password of 8-128 characters, and a name of 1-120 characters." },
        { status: 400 }
      );
    }

    if (role !== "client" && role !== "talent") {
      return NextResponse.json({ error: "Choose whether you are a client or talent." }, { status: 400 });
    }

    const dbRole = role === "talent" ? "TALENT" : "CLIENT";
    let dbClientType: "INDIVIDUAL" | "ORGANIZATION" | null = null;
    if (dbRole === "CLIENT") {
      if (!isOneOf(CLIENT_TYPES, clientType)) {
        return NextResponse.json({ error: "Choose whether you are posting as an individual or an organization." }, { status: 400 });
      }
      dbClientType = clientType;
    }

    const cleanEmail = email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in instead." },
        { status: 400 }
      );
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email: cleanEmail,
        name: fullName.trim(),
        password: hashedPassword,
        role: dbRole,
        clientType: dbClientType,
      },
    });

    await audit({ userId: user.id, role: user.role }, "user.signup", "user", user.id, {
      role: user.role,
      clientType: dbClientType,
    });

    void sendEmailVerification(user);
    if (user.role === "TALENT") {
      void attachPendingInvites(user).catch((e) => console.error("attach invites failed", e));
    }

    const token = await createToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await setAuthCookie(token);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account. Please try again." },
      { status: 500 }
    );
  }
}
