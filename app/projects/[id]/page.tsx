import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { projectListInclude } from "@/lib/queries";
import { CLIENT_TYPE_LABEL, PROJECT_CATEGORY_LABEL, statusLabel } from "@/lib/enums";

function fmt(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Public project detail (FR-S3). Owner and admin can view non-active projects. */
export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const now = new Date();
  const [project, session] = await Promise.all([
    prisma.project.findUnique({ where: { id }, include: projectListInclude }),
    getSession(),
  ]);
  if (!project) notFound();

  const isOwner = session?.role === "CLIENT" && session.userId === project.clientId;
  // Analytics perk: count views by anyone but the owner (best effort, never blocks render).
  if (!isOwner && project.status === "ACTIVE") void prisma.project.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
  if (project.status !== "ACTIVE" && !isOwner && session?.role !== "ADMIN") notFound();

  const daysLeft = Math.max(0, Math.ceil((project.deadline.getTime() - now.getTime()) / 86_400_000));
  const open = project.status === "ACTIVE" && project.deadline > now;

  let cta: React.ReactNode;
  if (isOwner) {
    cta = <Link href="/client/dashboard?tab=projects" className="inline-block w-full text-center py-3 rounded-lg border border-navy text-navy font-bold text-sm">Manage in your dashboard</Link>;
  } else if (session?.role === "TALENT") {
    cta = open
      ? <Link href={`/talent/dashboard?tab=projects&apply=${project.id}`} className="inline-block w-full text-center py-3 rounded-lg bg-navy text-paper font-bold text-sm hover:bg-navy-dark">Apply now →</Link>
      : <span className="inline-block w-full text-center py-3 rounded-lg bg-gray-100 text-gray-500 font-bold text-sm">Applications closed</span>;
  } else if (!session) {
    cta = <Link href={`/auth/login?next=${encodeURIComponent(`/projects/${project.id}`)}`} className="inline-block w-full text-center py-3 rounded-lg bg-navy text-paper font-bold text-sm hover:bg-navy-dark">Sign in as talent to apply</Link>;
  }

  return (
    <div className="min-h-screen bg-paper">
      <section className="bg-gradient-to-b from-navy-dark to-navy text-paper py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/projects" className="text-gold hover:underline text-sm mb-4 inline-block">← All projects</Link>
          <span className="block text-[11px] font-bold text-gold uppercase tracking-wider mb-2">{PROJECT_CATEGORY_LABEL[project.category]}</span>
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 break-words">{project.title}</h1>
          <div className="flex flex-wrap gap-3 items-center text-sm text-paper/85">
            <Link href={`/clients/${project.client.id}`} className="font-semibold text-gold hover:underline">{project.client.name}</Link>
            {project.client.clientType && <span>· {CLIENT_TYPE_LABEL[project.client.clientType]}</span>}
            <span className={`px-2 py-0.5 rounded text-xs font-bold ${project.client.verificationStatus === "VERIFIED" ? "bg-green-500/20 text-green-200" : "bg-white/10 text-paper/70"}`}>
              {project.client.verificationStatus === "VERIFIED" ? "✓ Verified client" : "Unverified client"}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-white/10">{statusLabel(project.status)}</span>
            {project.featured && <span className="px-2 py-0.5 rounded text-xs font-bold bg-gold text-navy">★ Featured</span>}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white rounded-xl border border-navy/5 p-8">
              <h2 className="text-xl font-bold text-navy mb-3">About the project</h2>
              <p className="text-ink/80 leading-relaxed whitespace-pre-wrap">{project.description}</p>
            </div>
            <div className="bg-white rounded-xl border border-navy/5 p-8">
              <h2 className="text-xl font-bold text-navy mb-3">Deliverables</h2>
              <p className="text-ink/80 leading-relaxed whitespace-pre-wrap">{project.deliverables}</p>
            </div>
            <div className="bg-white rounded-xl border border-navy/5 p-8">
              <h2 className="text-xl font-bold text-navy mb-3">Skills you&apos;ll use</h2>
              <p className="text-xs text-ink/60 mb-3">These are printed on the certificate when the work is approved.</p>
              <div className="flex flex-wrap gap-2">
                {project.requiredSkills.map(s => <span key={s} className="px-3 py-1 bg-navy/5 text-navy rounded-full text-xs font-semibold border border-navy/10">{s}</span>)}
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="bg-white rounded-xl border border-navy/5 p-6 space-y-4">
              <div className="flex justify-between text-sm"><span className="text-ink/60">Deadline</span><span className={`font-bold ${daysLeft <= 3 ? "text-red-700" : "text-navy"}`}>{fmt(project.deadline)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink/60">Time left</span><span className="font-bold text-navy">{open ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""}` : "Closed"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink/60">Team size</span><span className="font-bold text-navy">{project.teamCap > 1 ? `teams of up to ${project.teamCap}` : "individuals only"}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink/60">Applications</span><span className="font-bold text-navy">{project._count.applications}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink/60">Posted</span><span className="font-bold text-navy">{fmt(project.publishedAt ?? project.createdAt)}</span></div>
              <div className="pt-2">{cta}</div>
            </div>
            <div className="bg-[#FFFDF5] rounded-xl border border-gold/30 p-6 text-sm text-ink/80">
              <div className="font-bold text-navy mb-1">🏅 What you earn</div>
              A verifiable certificate in your name, listing this project, the client and the skills above. Recruiters can check it at <span className="font-mono">/verify</span> without an account.
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
