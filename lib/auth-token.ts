import { jwtVerify, SignJWT } from "jose";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error("JWT_SECRET is not configured");
const JWT_SECRET = new TextEncoder().encode(jwtSecret);

/**
 * Sessions slide: each request past the refresh threshold pushes the DB
 * expiry out by SESSION_IDLE_SECONDS. Nothing survives SESSION_MAX_SECONDS
 * after login (the JWT itself expires then), so a stolen cookie has a hard end.
 */
export const SESSION_IDLE_SECONDS = 7 * 24 * 60 * 60;      // 7 days without activity
export const SESSION_MAX_SECONDS = 30 * 24 * 60 * 60;      // 30 days absolute
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 60;      // extend at most hourly (limits DB writes)
/** @deprecated use SESSION_IDLE_SECONDS */
export const SESSION_TTL_SECONDS = SESSION_IDLE_SECONDS;

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  role: "CLIENT" | "TALENT" | "ADMIN";
}

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ["HS256"] });
    if (
      typeof payload.userId !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.name !== "string" ||
      !["CLIENT", "TALENT", "ADMIN"].includes(String(payload.role))
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}