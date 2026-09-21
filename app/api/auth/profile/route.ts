import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSelect } from "@/lib/queries";
import { isHttpUrl } from "@/lib/validation";

function optionalText(value: unknown, max = 500): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text.length > max ? text.slice(0, max) : text;
}

function optionalUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return isHttpUrl(value) ? String(value) : undefined;
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: profileSelect,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.role === "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    const commonFields = ["name", "bio", "website", "phone", "location"] as const;
    for (const field of commonFields) {
      const value = payload[field];
      if (value === undefined) continue;
      if (field === "name") {
        const next = typeof value === "string" ? value.trim() : "";
        if (!next) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
        data.name = next;
        continue;
      }
      const normalized = optionalText(value, field === "bio" ? 2000 : 200);
      if (normalized !== undefined) data[field] = normalized;
    }

    if (session.role === "CLIENT") {
      const clientFields = ["industry", "organizationSize", "registrationNumber", "linkedinUrl"] as const;
      for (const field of clientFields) {
        const value = payload[field];
        if (value === undefined) continue;
        if (field === "linkedinUrl") {
          const normalized = optionalUrl(value);
          if (normalized !== undefined) data[field] = normalized;
          continue;
        }
        const normalized = optionalText(value, 200);
        if (normalized !== undefined) data[field] = normalized;
      }
    }

    if (session.role === "TALENT") {
      const talentFields = ["gender", "universityName", "degreeProgram", "currentSemester", "portfolioUrl", "resumeUrl"] as const;
      for (const field of talentFields) {
        const value = payload[field];
        if (value === undefined) continue;
        if (field === "portfolioUrl" || field === "resumeUrl") {
          const normalized = optionalUrl(value);
          if (normalized !== undefined) data[field] = normalized;
          continue;
        }
        const normalized = optionalText(value, 200);
        if (normalized !== undefined) data[field] = normalized;
      }

      if (payload.skills !== undefined) {
        const raw = Array.isArray(payload.skills)
          ? payload.skills
          : typeof payload.skills === "string"
            ? payload.skills.split(",")
            : [];
        const skills = Array.from(new Set(raw.map((item) => String(item).trim()).filter(Boolean))).slice(0, 30);
        data.skills = skills;
      }

      if (payload.gpa !== undefined) {
        if (payload.gpa === null || payload.gpa === "") {
          data.gpa = null;
        } else {
          const gpa = Number(payload.gpa);
          if (!Number.isNaN(gpa) && gpa >= 0 && gpa <= 4) data.gpa = gpa;
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error) {
    console.error("Update profile error:", error);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
