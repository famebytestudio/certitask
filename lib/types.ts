/**
 * Shapes returned by the JSON API and consumed by the dashboards.
 * Dates are ISO strings on the wire.
 */
import type {
  ApplicationStatus,
  CertificateStatus,
  ClientType,
  ProjectCategory,
  ProjectStatus,
  SubmissionStatus,
  VerificationStatus,
} from "@/lib/enums";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "client" | "talent" | "admin";
}

export interface ProfileDto {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
  name: string;
  legalName: string | null;
  role: "CLIENT" | "TALENT";
  clientType: ClientType | null;
  verificationStatus: VerificationStatus;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  phone: string | null;
  location: string | null;
  industry: string | null;
  organizationSize: string | null;
  foundedYear: number | null;
  registrationNumber: string | null;
  linkedinUrl: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  universityName: string | null;
  degreeProgram: string | null;
  currentSemester: string | null;
  gpa: number | null;
  skills: string[];
  portfolioUrl: string | null;
  resumeUrl: string | null;
  idLast4: string | null;
  createdAt: string;
}

export interface ProjectDto {
  id: string;
  clientId: string;
  title: string;
  description: string;
  category: ProjectCategory;
  requiredSkills: string[];
  deliverables: string;
  deadline: string;
  teamCap: number;
  status: ProjectStatus;
  publishedAt: string | null;
  closedAt?: string | null;
  featured?: boolean;
  viewCount?: number;
  subscription?: { plan: "STARTER" | "GROWTH" | "PRO" } | null;
  createdAt: string;
  client?: { id: string; name: string; clientType: ClientType | null; avatarUrl: string | null; verificationStatus: VerificationStatus };
  _count?: { applications: number; submissions: number; teams?: number };
}

export type TeamMemberStatus = "INVITED" | "ACCEPTED" | "DECLINED" | "REMOVED" | "EXPIRED" | "LEFT";

export interface TeamMemberDto {
  id: string;
  role: "LEAD" | "MEMBER";
  status: TeamMemberStatus;
  invitedAt?: string;
  expiresAt?: string | null;
  respondedAt?: string | null;
  user: { id: string; name: string; email: string; verificationStatus: VerificationStatus };
}

export interface TeamDto {
  id: string;
  name: string;
  projectId: string;
  leadId: string;
  members: TeamMemberDto[];
}

/** Full team as returned by /api/teams and the talent dashboard. */
export interface TeamFullDto extends TeamDto {
  createdAt: string;
  project: { id: string; title: string; status: ProjectStatus; deadline: string; teamCap: number; client: { id: string; name: string } };
  lead: { id: string; name: string };
  invites: { id: string; email: string; expiresAt: string; createdAt: string }[];
  application: { id: string; status: ApplicationStatus; createdAt: string } | null;
  submission: { id: string; status: SubmissionStatus } | null;
}

export interface ApplicationDto {
  id: string;
  projectId: string;
  teamId: string;
  pitch: string;
  status: ApplicationStatus;
  createdAt: string;
  project: { id: string; title: string; client?: { name: string } };
  team: TeamDto;
}

export interface SubmissionDto {
  id: string;
  projectId: string;
  teamId: string;
  submissionUrl: string;
  notes: string | null;
  feedback: string | null;
  status: SubmissionStatus;
  createdAt: string;
  project: { id: string; title: string; client?: { name: string } };
  team: { id: string; name: string; members?: TeamMemberDto[] };
  submittedBy: { id: string; name: string; email: string };
}

export interface CertificateDto {
  id: string;
  certId: string;
  title: string;
  recipientName: string;
  recipientEmail: string;
  issuerName: string;
  issuerType: ClientType;
  skills: string[];
  issuedAt: string;
  status: CertificateStatus;
  statusReason: string | null;
  project?: { id: string; title: string };
  client?: { id: string; name: string; avatarUrl: string | null };
  talent?: { id: string; name: string };
}

export interface CertificateHoldDto {
  id: string;
  createdAt: string;
  project: { id: string; title: string; client: { name: string } };
}

export interface DashboardResponse {
  user: SessionUser;
  profile: ProfileDto;
  projects: ProjectDto[];
  applications: ApplicationDto[];
  submissions: SubmissionDto[];
  certificates: CertificateDto[];
  certificateHolds: CertificateHoldDto[];
  teams: TeamFullDto[];
  entitlement: EntitlementDto | null;
}

export interface EntitlementDto {
  verified: boolean;
  freePostsUsed: number;
  freePostsLeft: number;
  postsLeftInPeriod: number | null;
  canPost: boolean;
  reason: "FREE" | "SUBSCRIPTION" | "NOT_VERIFIED" | "PLAN_REQUIRED" | "LIMIT_REACHED";
  subscription: { id: string; plan: "STARTER" | "GROWTH" | "PRO"; periodEnd: string | null; postsUsed: number; postLimit: number | null } | null;
  features: { applicantFilters: boolean; priorityVisibility: boolean; analytics: boolean; featured: boolean; prioritySupport: boolean };
}
