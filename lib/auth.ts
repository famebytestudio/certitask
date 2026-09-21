import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { SESSION_IDLE_SECONDS, signToken, verifyToken, type SessionPayload, SESSION_MAX_SECONDS, SESSION_REFRESH_AFTER_SECONDS } from "@/lib/auth-token";
import { COOKIE_NAME } from "@/lib/auth-constants";

export { COOKIE_NAME } from "@/lib/auth-constants";
export type { SessionPayload } from "@/lib/auth-token";

/* ── Password hashing ── */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/* ── JWT Token management ── */
export async function createToken(payload: SessionPayload): Promise<string> {
  const token = await signToken(payload);
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: payload.userId,
      expiresAt: new Date(Date.now() + SESSION_IDLE_SECONDS * 1000),
    },
  });
  return token;
}

export { verifyToken } from "@/lib/auth-token";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/* ── Session & Cookies ── */
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_SECONDS,
    path: "/",
  });
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;

  const tokenHash = hashToken(token);
  const storedSession = await prisma.session.findUnique({ where: { tokenHash } });
  const now = Date.now();
  if (!storedSession || storedSession.revokedAt || storedSession.expiresAt.getTime() <= now) {
    return null;
  }
  const hardEnd = storedSession.createdAt.getTime() + SESSION_MAX_SECONDS * 1000;
  if (hardEnd <= now) return null;

  // Sliding expiry: extend on activity, throttled so a busy dashboard doesn't write on every request.
  const target = Math.min(now + SESSION_IDLE_SECONDS * 1000, hardEnd);
  if (target - storedSession.expiresAt.getTime() > SESSION_REFRESH_AFTER_SECONDS * 1000) {
    prisma.session.update({ where: { tokenHash }, data: { expiresAt: new Date(target) } }).catch(() => { /* best effort */ });
  }

  if (payload.role === "ADMIN" && payload.userId === "super-admin") return payload;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { email: true, name: true, role: true, suspendedAt: true },
  });
  if (!user || user.suspendedAt || user.role !== payload.role) return null;

  return { ...payload, email: user.email, name: user.name, role: user.role };
}

export async function requireRole(
  ...roles: SessionPayload["role"][]
): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }
  if (!roles.includes(session.role)) {
    return NextResponse.json({ error: "You do not have access to this resource" }, { status: 403 });
  }
  return session;
}

export async function requireAdmin(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Administrator access required" }, { status: 403 });
  }

  return session;
}
