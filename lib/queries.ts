/**
 * Shared Prisma `select` / `include` shapes so every route returns the same DTOs
 * (see lib/types.ts) and never leaks password hashes or ID numbers.
 */
import { Prisma } from "@prisma/client";

export const profileSelect = {
  id: true,
  email: true,
  emailVerifiedAt: true,
  name: true,
  legalName: true,
  role: true,
  clientType: true,
  verificationStatus: true,
  avatarUrl: true,
  bio: true,
  website: true,
  phone: true,
  location: true,
  industry: true,
  organizationSize: true,
  foundedYear: true,
  registrationNumber: true,
  linkedinUrl: true,
  dateOfBirth: true,
  gender: true,
  universityName: true,
  degreeProgram: true,
  currentSemester: true,
  gpa: true,
  skills: true,
  portfolioUrl: true,
  resumeUrl: true,
  idLast4: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

/** Minimal public identity of a user, safe to show to anyone. */
export const publicUserSelect = {
  id: true,
  name: true,
  clientType: true,
  avatarUrl: true,
  verificationStatus: true,
} satisfies Prisma.UserSelect;

export const teamInclude = {
  members: {
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true, verificationStatus: true } },
    },
    orderBy: { invitedAt: "asc" },
  },
} satisfies Prisma.TeamInclude;

export const projectListInclude = {
  client: { select: publicUserSelect },
  subscription: { select: { plan: true } },
  _count: { select: { applications: true, submissions: true, teams: true } },
} satisfies Prisma.ProjectInclude;

export const applicationInclude = {
  project: { select: { id: true, title: true, client: { select: { name: true } } } },
  team: { include: teamInclude },
} satisfies Prisma.ApplicationInclude;

export const submissionInclude = {
  project: { select: { id: true, title: true, client: { select: { name: true } } } },
  team: { include: teamInclude },
  submittedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.SubmissionInclude;

export const certificateInclude = {
  project: { select: { id: true, title: true } },
  client: { select: { id: true, name: true, avatarUrl: true } },
  talent: { select: { id: true, name: true } },
} satisfies Prisma.CertificateInclude;
