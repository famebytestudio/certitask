# CertiTask

CertiTask turns real project work into verifiable professional proof. Clients
post projects, talent applies or forms a team, the client reviews submissions,
and approved work becomes a publicly verifiable certificate.

Built with Next.js 16, React 19, TypeScript, Prisma ORM 7, Neon PostgreSQL,
and custom JWT sessions.

## Product Features

### Client workspace

- Create and edit a client profile, including organization details and contact links.
- Post, edit, pause, and close projects with categories, deadlines, skills, budgets, and team-size requirements.
- Review applications, shortlist or select talent, and manage project teams.
- Review submissions and issue certificates for accepted work.
- Track projects, applications, submissions, certificates, verification, and billing from one dashboard at `/client/dashboard`.

### Talent workspace

- Browse active projects and apply individually or with a team.
- Create and manage teams, invite members, and submit completed work.
- Track applications, selected projects, submission status, and certificates at `/talent/dashboard`.
- Maintain a public talent profile with skills, education, portfolio, resume, and verification status.

### Trust, verification, and certificates

- Email verification and password reset flows.
- Client and talent identity/profile verification with document uploads.
- Unique certificate IDs with public verification pages at `/verify` and `/verify/[certId]`.
- Certificate PDFs and certificate hold/review handling.
- Audit logs and in-app notifications for important workflow events.

### Administration and billing

- Admin login and dashboards for users, projects, payments, contact messages, and verification queues.
- Safepay-hosted checkout with webhook confirmation and payment receipts.
- Talent accounts are free. Verified clients receive `FREE_POSTS` free project posts, then choose a prepaid plan:
  - **Starter**: 5 posts per 30 days, applications and team rosters.
  - **Growth**: 15 posts per 30 days, applicant filters, priority visibility, and analytics.
  - **Pro**: unlimited posts, featured placement, priority support, and all Growth features.
- Default plan prices are `$5`, `$10`, and `$20`; prices can be overridden with environment variables.
- Plans do not auto-charge. Clients renew or upgrade when needed.

## Tech Stack

- **Framework:** Next.js 16 App Router and React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4 and the project CSS design system
- **Database:** Neon PostgreSQL
- **ORM:** Prisma 7 with `@prisma/adapter-pg` and `pg`
- **Authentication:** `bcryptjs` password hashing, `jose` JWTs, hashed server-side sessions, HTTP-only cookies
- **Payments:** Safepay hosted checkout and webhooks
- **Email:** Nodemailer-compatible SMTP provider
- **Rate limiting:** Upstash Redis when configured, otherwise an in-memory development fallback

## Requirements

- Node.js 18 or newer
- npm 9 or newer
- A PostgreSQL database, recommended: Neon

## Environment Configuration

Copy `.env.example` to `.env.local` and fill in the values. Never commit `.env`
or `.env.local`.

### Required

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
JWT_SECRET="a-long-random-secret"
```

The password in `DATABASE_URL` must be URL-encoded if it contains reserved URL
characters. `DATABASE_URL` must use current credentials from the Neon project.

### Admin

```env
SUPER_ADMIN_EMAIL="admin@example.com"
SUPER_ADMIN_PASSWORD_HASH=""
```

Generate a password hash with:

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

### Email and application URL

```env
APP_URL="http://localhost:3000"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="no-reply@example.com"
```

Email features are skipped when SMTP is not configured. `APP_URL` is used for
links in verification and password-reset emails.

### Optional services

```env
CERTIFICATE_SIGNING_KEY=""
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""
CRON_SECRET=""
ID_HASH_PEPPER=""
```

`CERTIFICATE_SIGNING_KEY` and `ID_HASH_PEPPER` fall back to `JWT_SECRET` when
empty. Upstash is recommended for distributed rate limiting in production.

### Safepay billing

```env
SAFEPAY_ENV="sandbox"
SAFEPAY_BASE_URL="https://sandbox.api.getsafepay.com"
SAFEPAY_PUBLIC_KEY=""
SAFEPAY_SECRET_KEY=""
SAFEPAY_WEBHOOK_SECRET=""
PLAN_PRICE_STARTER_CENTS=""
PLAN_PRICE_GROWTH_CENTS=""
PLAN_PRICE_PRO_CENTS=""
FREE_POSTS=""
```

Use matching Safepay sandbox or production values. `FREE_POSTS` defaults to 2,
and plan prices default to 500, 1000, and 2000 USD cents.

## Setup and Local Development

```bash
git clone https://github.com/FaizaNaseem80/Certi-task.git
cd certitask
npm install
```

After configuring the database:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For local schema
experimentation, use `npx prisma db push`; use committed migrations for shared
or production databases. The seed script is available with:

```bash
npm run seed
```

Useful scripts:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Generate Prisma client and build the production app |
| `npm run start` | Start the production build |
| `npm run lint` | Run ESLint |
| `npm run seed` | Run `scripts/seed.js` |

## Main Routes

| Route | Purpose |
| --- | --- |
| `/` | Public product homepage |
| `/projects` and `/projects/[id]` | Browse project listings and details |
| `/clients` and `/clients/[id]` | Browse public client profiles |
| `/talents/[id]` | View public talent profiles |
| `/pricing` | Client plans and Safepay billing information |
| `/auth/signup` | Create a client or talent account |
| `/auth/login` | Sign in |
| `/auth/verify-email` | Verify an email address |
| `/auth/forgot-password` and `/auth/reset-password` | Password recovery |
| `/client/dashboard` | Client project, review, certificate, verification, and billing workspace |
| `/talent/dashboard` | Talent project, team, application, submission, and certificate workspace |
| `/admin/login` and `/admin/dashboard` | Administrative operations |
| `/certificates/[id]` | View a certificate |
| `/verify` | Verify a certificate by ID |
| `/about`, `/how-it-works`, `/contact` | Public information and contact pages |
| `/payment/success` and `/payment/cancel` | Safepay checkout results |

The API follows the same domain areas under `/api`: authentication, projects,
applications, submissions, teams, certificates, verification, notifications,
clients, talents, billing, Safepay webhooks, admin operations, and scheduled
jobs.

## Data Model

The Prisma schema includes users and role-specific profiles, projects, teams,
applications, submissions, certificates, certificate holds, verification
requests and documents, payments, subscriptions, audit logs, notifications,
contact messages, sessions, and password/email verification tokens.

Database configuration is in `prisma/schema.prisma` and `prisma.config.ts`.
The Prisma client singleton and PostgreSQL adapter are in `lib/prisma.ts`.

## Production Notes

- Run `npx prisma migrate deploy` before starting a deployment.
- Use production Safepay credentials and a webhook endpoint at
  `/api/safepay/webhook`.
- Set `APP_URL` to the public HTTPS origin.
- Configure SMTP for email verification, password reset, and certificate delivery.
- Configure Upstash Redis when running more than one application instance.
- Protect cron endpoints with `CRON_SECRET`.
- Keep database credentials, JWT secrets, payment keys, SMTP credentials, and
  admin password hashes out of source control.
