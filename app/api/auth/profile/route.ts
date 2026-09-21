import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { profileSelect } from "@/lib/queries";
import { isHttpUrl } from "@/lib/validation";

// GET: Load the authenticated user's full profile
/** GET: the authenticated user's own profile. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session || session.role === "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        website: true,
        logoUrl: true,
        domain: true,
        phone: true,
        location: true,
        role: true,
        // Company-specific
        companySize: true,
        industry: true,
        foundedYear: true,
        companyDescription: true,
        companyWebsite: true,
        linkedinUrl: true,
        // Student-specific
        cnicNumber: true,
        cnicVerified: true,
        dateOfBirth: true,
        gender: true,
        universityName: true,
        degreeProgram: true,
        currentSemester: true,
        gpa: true,
        skillsArray: true,
        portfolioUrl: true,
        resumeUrl: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const user = await prisma.user.findUnique({ where: { id: session.userId }, select: profileSelect });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ success: true, user });
  } catch (err) {
    console.error('Fetch profile error:', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    console.error("Fetch profile error:", err);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

// PATCH: Update the authenticated user's profile
function normalizeCnic(value: string): string | null {
  const digits = value.replace(/\D/g, '').trim();
  if (digits.length !== 13) return null;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
const COMMON_TEXT = ["name", "bio", "phone", "location"] as const;
const COMMON_URL = ["website", "avatarUrl", "linkedinUrl"] as const;
const ORG_TEXT = ["industry", "organizationSize", "registrationNumber"] as const;
const TALENT_TEXT = ["gender", "universityName", "degreeProgram", "currentSemester"] as const;
const TALENT_URL = ["portfolioUrl", "resumeUrl"] as const;

function optionalText(value: unknown, max = 500): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const v = value.trim();
  return v.length > max ? v.slice(0, max) : v;
}

function optionalUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  return isHttpUrl(value) ? value : undefined;
}

/**
 * PATCH: update the authenticated user's editable profile fields.
 * Identity fields (legalName, ID number, verification status) are NOT editable
 * here — they are set through the verification flow (Phase 2).
 */
export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!session || session.role === "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();
    const allowed: Record<string, unknown> = {};
    const payload: Record<string, unknown> = await req.json();
    const data: Record<string, unknown> = {};

    // Common fields all users can edit
    const commonFields = ['name', 'bio', 'website', 'logoUrl', 'domain', 'phone', 'location'];
    for (const f of commonFields) {
      if (payload[f] !== undefined) allowed[f] = String(payload[f]).trim();
    for (const f of COMMON_TEXT) {
      const v = optionalText(payload[f], f === "bio" ? 2000 : 200);
      if (v !== undefined) data[f] = v;
    }
    if (typeof data.name === "string" && data.name.length === 0) {
      return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    }
    if (data.name === null) delete data.name;

    const role = (session.role || '').toUpperCase();
    for (const f of COMMON_URL) {
      const v = optionalUrl(payload[f]);
      if (v !== undefined) data[f] = v;
    }

    // Company-specific fields
    if (role === 'COMPANY') {
      const companyFields = ['companySize', 'industry', 'companyDescription', 'companyWebsite', 'linkedinUrl'];
      for (const f of companyFields) {
        if (payload[f] !== undefined) allowed[f] = String(payload[f]).trim();
    if (session.role === "CLIENT") {
      for (const f of ORG_TEXT) {
        const v = optionalText(payload[f], 200);
        if (v !== undefined) data[f] = v;
      }
      if (payload.cnicNumber !== undefined) {
        const cnic = String(payload.cnicNumber).trim();
        if (/^\d{5}-\d{7}-\d{1}$/.test(cnic)) {
          allowed.cnicNumber = cnic;
        } else if (cnic.length > 0) {
          const digits = cnic.replace(/\D/g, '');
          if (digits.length === 13) {
            allowed.cnicNumber = `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
          }
      if (payload.foundedYear !== undefined) {
        if (payload.foundedYear === null || payload.foundedYear === "") {
          data.foundedYear = null;
        } else {
          const yr = parseInt(String(payload.foundedYear), 10);
          if (!Number.isNaN(yr) && yr >= 1800 && yr <= new Date().getFullYear()) data.foundedYear = yr;
        }
      }
      if (payload.foundedYear !== undefined && payload.foundedYear !== null && payload.foundedYear !== '') {
        const yr = parseInt(String(payload.foundedYear));
        if (!isNaN(yr) && yr >= 1800 && yr <= new Date().getFullYear()) {
          allowed.foundedYear = yr;
        }
      }
    }

    // Student-specific fields
    if (role === 'STUDENT') {
      const studentStringFields = [
        'dateOfBirth', 'gender', 'universityName', 'degreeProgram',
        'currentSemester', 'portfolioUrl', 'resumeUrl',
      ];
      for (const f of studentStringFields) {
        if (payload[f] !== undefined) allowed[f] = String(payload[f]).trim();
    if (session.role === "TALENT") {
      for (const f of TALENT_TEXT) {
        const v = optionalText(payload[f], 200);
        if (v !== undefined) data[f] = v;
      }

      // Handle both skills and skillsArray
      const skillsInput = payload.skillsArray !== undefined ? payload.skillsArray : payload.skills;
      if (skillsInput !== undefined) {
        allowed.skillsArray = String(skillsInput).trim();
      for (const f of TALENT_URL) {
        const v = optionalUrl(payload[f]);
        if (v !== undefined) data[f] = v;
      }

      if (payload.gpa !== undefined && payload.gpa !== null && payload.gpa !== '') {
        const g = parseFloat(String(payload.gpa));
        if (!isNaN(g) && g >= 0 && g <= 4) {
          allowed.gpa = g;
      if (payload.skills !== undefined) {
        const raw = Array.isArray(payload.skills)
          ? payload.skills
          : typeof payload.skills === "string"
            ? payload.skills.split(",")
            : [];
        const skills = Array.from(
          new Set(raw.map((s) => String(s).trim()).filter((s) => s.length > 0 && s.length <= 40))
        ).slice(0, 30);
        data.skills = skills;
      }
      if (payload.gpa !== undefined) {
        if (payload.gpa === null || payload.gpa === "") {
          data.gpa = null;
        } else {
          const g = parseFloat(String(payload.gpa));
          if (!Number.isNaN(g) && g >= 0 && g <= 4) data.gpa = g;
        }
      }
      // CNIC number submission — once submitted it marks cnicVerified as true
      if (payload.cnicNumber !== undefined) {
        const normalized = normalizeCnic(String(payload.cnicNumber).trim());
        if (!normalized) {
          return NextResponse.json({ error: 'Enter a valid 13-digit CNIC.' }, { status: 400 });
      if (payload.dateOfBirth !== undefined) {
        if (payload.dateOfBirth === null || payload.dateOfBirth === "") {
          data.dateOfBirth = null;
        } else {
          const d = new Date(String(payload.dateOfBirth));
          if (!Number.isNaN(d.getTime()) && d < new Date()) data.dateOfBirth = d;
        }
        allowed.cnicNumber = normalized;
      }
    }

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    if (allowed.cnicNumber !== undefined) {
      allowed.cnicVerified = true;
      const duplicate = await prisma.user.findFirst({
        where: {
          cnicNumber: String(allowed.cnicNumber),
          NOT: { id: session.userId },
        },
        select: { id: true },
      });

      if (duplicate) {
        return NextResponse.json({ error: 'This CNIC is already registered with another account.' }, { status: 409 });
      }
    }

    const updated = await prisma.user.update({
      where: { id: session.userId },
      data: allowed,
      select: {
        id: true,
        name: true,
        email: true,
        bio: true,
        website: true,
        domain: true,
        logoUrl: true,
        phone: true,
        location: true,
        role: true,
        companySize: true,
        industry: true,
        foundedYear: true,
        companyDescription: true,
        companyWebsite: true,
        linkedinUrl: true,
        cnicNumber: true,
        cnicVerified: true,
        dateOfBirth: true,
        gender: true,
        universityName: true,
        degreeProgram: true,
        currentSemester: true,
        gpa: true,
        skillsArray: true,
        portfolioUrl: true,
        resumeUrl: true,
      },
      data,
      select: profileSelect,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err) {
    const error = err as { code?: string; meta?: { target?: string[] } };
    if (error?.code === 'P2002' && Array.isArray(error.meta?.target) && error.meta.target.includes('cnicNumber')) {
      return NextResponse.json({ error: 'This CNIC is already registered with another account.' }, { status: 409 });
    }
    console.error('Update profile error:', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    console.error("Update profile error:", err);
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
  }
}
