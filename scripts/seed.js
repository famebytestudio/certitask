/**
 * Demo data for local development and reviews.
 *   npm run seed
 *
 * Creates: 2 clients (1 organization, 1 individual), 4 talents, 3 projects,
 * one solo application + selection + approved submission + certificate, one
 * pending application. Every account's password is `Password123!`.
 *
 * Safe to re-run: existing demo accounts are updated, demo projects are reset.
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createHash, createHmac, randomBytes, randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

function loadEnvFile() {
  for (const file of [".env", ".env.local"]) {
    const filePath = path.resolve(__dirname, "..", file);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const key = t.slice(0, i).trim();
      let value = t.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFile();

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
const signingKey = process.env.CERTIFICATE_SIGNING_KEY || process.env.JWT_SECRET;
if (!signingKey) throw new Error("JWT_SECRET (or CERTIFICATE_SIGNING_KEY) is not configured");

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: true }, max: 5 });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const PASSWORD = "Password123!";
const daysFromNow = (n) => new Date(Date.now() + n * 86_400_000);

/* ── mirrors lib/certificates.ts ── */
function generateCertId() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) out += "-";
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `CERT-${out}`;
}
function signCertificate(c) {
  const payload = [c.certId, c.recipientName, c.recipientEmail.toLowerCase(), c.issuerName, c.projectId, c.title, c.issuedAt.toISOString()].join("|");
  return createHmac("sha256", signingKey).update(payload).digest("hex");
}

async function upsertUser(data) {
  const password = await bcrypt.hash(PASSWORD, 10);
  const { email, ...rest } = data;
  return prisma.user.upsert({
    where: { email },
    update: { ...rest, password },
    create: { email, ...rest, password },
  });
}

async function main() {
  console.log("Seeding CertiTask demo data…");

  /* ── Clients ── */
  const acme = await upsertUser({
    email: "projects@acmestudio.pk",
    name: "Acme Studio",
    legalName: "Acme Studio (Pvt) Ltd",
    role: "CLIENT",
    clientType: "ORGANIZATION",
    emailVerifiedAt: new Date(),
    verificationStatus: "VERIFIED",
    verifiedAt: new Date(),
    suspendedAt: null,
    freePostsUsed: 2, // both free posts already used; Acme is on a paid plan (seeded below)
    bio: "A Lahore design and development studio. We post small, real client tasks that our team doesn't have bandwidth for.",
    website: "https://acmestudio.pk",
    location: "Lahore, Pakistan",
    industry: "Technology",
    organizationSize: "11-50",
    foundedYear: 2018,
    linkedinUrl: "https://linkedin.com/company/acme-studio",
  });
  const ali = await upsertUser({
    email: "ali.raza@example.com",
    name: "Ali Raza",
    legalName: "Ali Raza",
    role: "CLIENT",
    clientType: "INDIVIDUAL",
    emailVerifiedAt: new Date(),
    verificationStatus: "UNVERIFIED",
    suspendedAt: null,
    freePostsUsed: 0,
    bio: "Independent consultant. I post research and content tasks for my clients' marketing.",
    location: "Karachi, Pakistan",
  });

  /* ── Talent ── */
  const talents = [];
  for (const t of [
    { email: "ayesha.khan@example.com", name: "Ayesha Khan", legalName: "Ayesha Khan", universityName: "NUST", degreeProgram: "BS Computer Science", currentSemester: "6", gpa: 3.7, skills: ["React", "Next.js", "TypeScript", "Tailwind CSS"], bio: "Frontend developer who likes shipping polished UI.", location: "Islamabad, Pakistan", portfolioUrl: "https://ayesha.dev", verificationStatus: "VERIFIED", verifiedAt: new Date() },
    { email: "bilal.ahmed@example.com", name: "Bilal Ahmed", universityName: "FAST-NUCES", degreeProgram: "BS Software Engineering", currentSemester: "8", gpa: 3.4, skills: ["Node.js", "PostgreSQL", "Prisma", "REST APIs"], bio: "Backend-leaning full-stack developer.", location: "Lahore, Pakistan" },
    { email: "sana.malik@example.com", name: "Sana Malik", universityName: "LUMS", degreeProgram: "BSc Management Science", currentSemester: "Graduated", skills: ["Market research", "Copywriting", "Notion", "Google Analytics"], bio: "Marketing and research. I write things people actually read.", location: "Lahore, Pakistan" },
    { email: "hamza.iqbal@example.com", name: "Hamza Iqbal", universityName: "COMSATS", degreeProgram: "BS Data Science", currentSemester: "4", gpa: 3.1, skills: ["Python", "Pandas", "SQL", "Data cleaning"], bio: "Data student looking for real datasets to work on.", location: "Islamabad, Pakistan" },
  ]) {
    // Reset verification state so re-seeding always returns to the demo baseline.
    const base = { verificationStatus: "UNVERIFIED", verifiedAt: null, legalName: null, idType: null, idNumberHash: null, idLast4: null, suspendedAt: null };
    const u = await upsertUser({ ...base, ...t, role: "TALENT", emailVerifiedAt: new Date() });
    await prisma.verificationRequest.deleteMany({ where: { userId: u.id } });
    await prisma.document.deleteMany({ where: { userId: u.id } });
    await prisma.certificateHold.deleteMany({ where: { talentId: u.id } });
    await prisma.notification.deleteMany({ where: { userId: u.id } });
    talents.push(u);
  }
  const [ayesha, bilal, sana] = talents;

  /* ── Bilal has submitted identity verification (pending in the admin queue) ── */
  await prisma.verificationRequest.deleteMany({ where: { userId: bilal.id } });
  await prisma.document.deleteMany({ where: { userId: bilal.id } });
  const placeholderPng = fs.readFileSync(path.join(__dirname, "assets", "sample-id.png")); // demo "ID card", clearly marked as a sample
  const docs = [];
  for (const type of ["ID_FRONT", "ID_BACK"]) {
    const key = `pg:${randomUUID()}`;
    await prisma.documentBlob.create({ data: { key, data: placeholderPng, mimeType: "image/png", sizeBytes: placeholderPng.length } });
    docs.push(await prisma.document.create({ data: { userId: bilal.id, type, storageKey: key, mimeType: "image/png", sizeBytes: placeholderPng.length } }));
  }
  const bilalCnic = "3520212345671";
  await prisma.verificationRequest.create({
    data: {
      userId: bilal.id, kind: "IDENTITY",
      formData: { legalName: "Bilal Ahmed", idType: "CNIC", idLast4: bilalCnic.slice(-4), authorizedPersonName: "Bilal Ahmed", registrationNumber: null },
      documents: { connect: docs.map((d) => ({ id: d.id })) },
    },
  });
  await prisma.user.update({
    where: { id: bilal.id },
    data: { verificationStatus: "PENDING_REVIEW", idType: "CNIC", idLast4: bilalCnic.slice(-4), idNumberHash: createHash("sha256").update(`${process.env.ID_HASH_PEPPER || process.env.JWT_SECRET}|CNIC|${bilalCnic}`).digest("hex") },
  });

  /* ── Projects (reset demo ones by title) ── */
  const projectDefs = [
    {
      client: acme, title: "Landing page for a bakery client", category: "WEB_AND_MOBILE",
      description: "Our client, a small bakery in Gulberg, needs a one-page responsive site: hero, menu, opening hours, map and a WhatsApp order button. Design is provided in Figma; you build it.",
      requiredSkills: ["React", "Next.js", "Tailwind CSS", "Responsive design"],
      deliverables: "Deployed URL (Vercel is fine), GitHub repo, and a short README with how to update the menu.",
      deadline: daysFromNow(21), teamCap: 2, status: "ACTIVE",
    },
    {
      client: acme, title: "Internal tools API: audit log endpoints", category: "SOFTWARE_DEVELOPMENT",
      description: "Add three read-only endpoints to an existing Express + Prisma service that expose an audit log with filtering and pagination. Tests required.",
      requiredSkills: ["Node.js", "Prisma", "PostgreSQL", "REST APIs", "Testing"],
      deliverables: "Pull request against our repo with passing CI, plus a Postman collection.",
      deadline: daysFromNow(14), teamCap: 1, status: "ACTIVE",
    },
    {
      client: ali, title: "Competitor research brief: home-tutoring apps in Pakistan", category: "RESEARCH_AND_WRITING",
      description: "A 6–8 page brief comparing the top five home-tutoring apps in Pakistan: pricing, positioning, reviews, and gaps. For a client pitch.",
      requiredSkills: ["Market research", "Copywriting", "Google Sheets"],
      deliverables: "PDF brief + the comparison spreadsheet.",
      deadline: daysFromNow(10), teamCap: 1, status: "ACTIVE",
    },
    {
      client: acme, title: "Mobile app onboarding redesign", category: "DESIGN_AND_UX",
      description: "Redesign the first-run experience of our client's fitness app: 5 screens, a prototype, and a short rationale doc. Ideal for a designer + a researcher + a front-end dev.",
      requiredSkills: ["Figma", "UX research", "Prototyping", "React Native"],
      deliverables: "Figma file with prototype, 2-page rationale, and a 3-minute walkthrough video.",
      deadline: daysFromNow(18), teamCap: 3, status: "ACTIVE",
    },
    {
      client: acme, title: "Clean and document a customer survey dataset", category: "DATA_AND_AI",
      description: "Completed demo project: a 4,000-row survey export needed de-duplication, normalisation and a data dictionary.",
      requiredSkills: ["Python", "Pandas", "Data cleaning"],
      deliverables: "Cleaned CSV, Jupyter notebook, data dictionary.",
      deadline: daysFromNow(-5), teamCap: 1, status: "COMPLETED",
    },
  ];

  // Drop accounts and projects left behind by automated smoke tests.
  await prisma.user.deleteMany({ where: { OR: [{ email: { startsWith: "smoke" } }, { email: { startsWith: "newbie+" } }, { email: { startsWith: "uitest." } }, { email: { contains: "+smoketest" } }] } });
  const smoke = await prisma.project.findMany({ where: { OR: [{ title: { startsWith: "Smoke" } }, { title: { startsWith: "UI test" } }] }, select: { id: true } });
  for (const sp of smoke) { await prisma.certificate.deleteMany({ where: { projectId: sp.id } }); await prisma.project.delete({ where: { id: sp.id } }); }

  const projects = {};
  for (const def of projectDefs) {
    const { client, ...data } = def;
    // Match by prefix so a title edited during testing ("… (v2)") is still reset.
    const existing = await prisma.project.findMany({ where: { clientId: client.id, title: { startsWith: def.title } }, select: { id: true } });
    for (const ex of existing) {
      // Certificates restrict project deletion on purpose; demo ones are safe to drop.
      await prisma.certificate.deleteMany({ where: { projectId: ex.id } });
      await prisma.project.delete({ where: { id: ex.id } }); // cascades teams/apps/subs/holds
    }
    projects[def.title] = await prisma.project.create({
      data: { ...data, clientId: client.id, publishedAt: new Date() },
    });
  }

  /* ── Flow 1: Ayesha applied to the bakery page and is SELECTED (ready to submit) ── */
  const bakery = projects["Landing page for a bakery client"];
  const ayeshaTeam = await prisma.team.create({
    data: {
      name: "Ayesha Khan", projectId: bakery.id, leadId: ayesha.id,
      members: { create: { userId: ayesha.id, role: "LEAD", status: "ACCEPTED", respondedAt: new Date() } },
    },
  });
  await prisma.application.create({
    data: { projectId: bakery.id, teamId: ayeshaTeam.id, status: "SELECTED", reviewedAt: new Date(), pitch: "I've built three restaurant sites in Next.js — here's one: https://ayesha.dev/work/cafe. Can start tomorrow." },
  });

  /* ── Flow 2: Bilal applied to the API project, still PENDING ── */
  const api = projects["Internal tools API: audit log endpoints"];
  const bilalTeam = await prisma.team.create({
    data: {
      name: "Bilal Ahmed", projectId: api.id, leadId: bilal.id,
      members: { create: { userId: bilal.id, role: "LEAD", status: "ACCEPTED", respondedAt: new Date() } },
    },
  });
  await prisma.application.create({
    data: { projectId: api.id, teamId: bilalTeam.id, pitch: "Prisma + Express is my daily stack. I'd add cursor pagination and cover the filters with supertest." },
  });

  /* ── Flow 3: Sana applied to the research brief, SHORTLISTED ── */
  const brief = projects["Competitor research brief: home-tutoring apps in Pakistan"];
  const sanaTeam = await prisma.team.create({
    data: {
      name: "Sana Malik", projectId: brief.id, leadId: sana.id,
      members: { create: { userId: sana.id, role: "LEAD", status: "ACCEPTED", respondedAt: new Date() } },
    },
  });
  await prisma.application.create({
    data: { projectId: brief.id, teamId: sanaTeam.id, status: "SHORTLISTED", reviewedAt: new Date(), pitch: "I wrote a similar brief for an edtech startup last year. Happy to share a redacted sample." },
  });

  /* ── Flow 3b: a team in progress on the onboarding redesign (Sana leads, Hamza joined, Bilal invited) ── */
  const [, , , hamza] = talents;
  const redesign = projects["Mobile app onboarding redesign"];
  await prisma.team.create({
    data: {
      name: "Pixel Pushers", projectId: redesign.id, leadId: sana.id,
      members: {
        create: [
          { userId: sana.id, role: "LEAD", status: "ACCEPTED", respondedAt: new Date() },
          { userId: hamza.id, role: "MEMBER", status: "ACCEPTED", invitedById: sana.id, respondedAt: new Date() },
          { userId: bilal.id, role: "MEMBER", status: "INVITED", invitedById: sana.id, expiresAt: daysFromNow(7) },
        ],
      },
    },
  });
  await prisma.notification.create({ data: { userId: bilal.id, type: "team.invite", title: "Team invitation: Pixel Pushers", body: `Sana Malik invited you to join "Pixel Pushers" for "${redesign.title}".`, link: "/talent/dashboard?tab=teams" } });

  /* ── Flow 4: completed project with an approved submission and a certificate for Ayesha ── */
  const survey = projects["Clean and document a customer survey dataset"];
  const surveyTeam = await prisma.team.create({
    data: {
      name: "Ayesha Khan", projectId: survey.id, leadId: ayesha.id,
      members: { create: { userId: ayesha.id, role: "LEAD", status: "ACCEPTED", respondedAt: new Date() } },
    },
  });
  await prisma.application.create({
    data: { projectId: survey.id, teamId: surveyTeam.id, status: "SELECTED", reviewedAt: daysFromNow(-20), pitch: "Pandas is my comfort zone." },
  });
  await prisma.submission.create({
    data: {
      projectId: survey.id, teamId: surveyTeam.id, submittedById: ayesha.id,
      submissionUrl: "https://github.com/ayesha-khan/survey-cleanup", notes: "Notebook runs top to bottom; dictionary is in /docs.",
      status: "APPROVED", reviewedAt: daysFromNow(-6), feedback: "Clean, well documented. Thanks!",
    },
  });
  await prisma.certificate.deleteMany({ where: { projectId: survey.id } });
  const issuedAt = daysFromNow(-6);
  const certId = generateCertId();
  await prisma.certificate.create({
    data: {
      certId,
      talentId: ayesha.id, clientId: acme.id, projectId: survey.id, teamId: surveyTeam.id,
      recipientName: ayesha.legalName || ayesha.name, recipientEmail: ayesha.email,
      issuerName: acme.legalName || acme.name, issuerType: "ORGANIZATION",
      title: survey.title, skills: survey.requiredSkills, issuedAt,
      signature: signCertificate({ certId, recipientName: ayesha.legalName || ayesha.name, recipientEmail: ayesha.email, issuerName: acme.legalName || acme.name, projectId: survey.id, title: survey.title, issuedAt }),
    },
  });

  /* ── Billing: Acme is 12 days into a Growth plan with one paid receipt ── */
  await prisma.payment.deleteMany({ where: { clientId: { in: [acme.id, ali.id] } } });
  await prisma.subscription.deleteMany({ where: { clientId: { in: [acme.id, ali.id] } } });
  const growth = await prisma.subscription.create({
    data: { clientId: acme.id, plan: "GROWTH", status: "ACTIVE", periodStart: daysFromNow(-12), periodEnd: daysFromNow(18), postLimit: 15, postsUsed: 2 },
  });
  await prisma.payment.create({
    data: {
      clientId: acme.id, subscriptionId: growth.id, plan: "GROWTH", provider: "safepay", providerRef: `seed_${growth.id}`, providerState: "TRACKER_ENDED",
      amountCents: 1000, currency: "USD", status: "SUCCEEDED", receiptNumber: `CT-${new Date().getFullYear()}-000001`, paidAt: daysFromNow(-12), createdAt: daysFromNow(-12),
    },
  });
  // The two live Acme projects count against this period; the older ones were free posts.
  await prisma.project.updateMany({ where: { id: { in: [bakery.id, api.id] } }, data: { subscriptionId: growth.id, viewCount: 37 } });
  await prisma.project.update({ where: { id: bakery.id }, data: { featured: true, viewCount: 112 } });

  // Contact messages: reset to the single demo message (drops smoke/UI-test leftovers).
  await prisma.contactMessage.deleteMany({});
  await prisma.contactMessage.create({
    data: { name: "Fatima N.", email: "fatima@example.com", subject: "Onboarding my NGO", message: "We run a literacy NGO and want to post a few design tasks. What documents do you need for verification?", type: "client_query" },
  });

  console.log(`
Done. Sign in with password "${PASSWORD}":

  Client (organization, verified, Growth plan)  projects@acmestudio.pk
  Client (individual, unverified)   ali.raza@example.com
  Talent (verified, 1 certificate)  ayesha.khan@example.com
  Talent (verification pending, team invite waiting)  bilal.ahmed@example.com
  Talent (leads team "Pixel Pushers")                 sana.malik@example.com
  Talent                            hamza.iqbal@example.com

  Demo certificate to verify at /verify:  ${certId}
`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
