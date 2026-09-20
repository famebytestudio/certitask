"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Btn, Card, EmptyState, Field, Modal, Notice, SectionHeader, SkillChips, VerificationBadge, daysUntil, formatDate, inputStyle, selectStyle, textareaStyle } from "@/components/dashboard/ui";
import { api } from "@/components/dashboard/useDashboardData";
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_LABEL, CLIENT_TYPE_LABEL } from "@/lib/enums";
import type { ApplicationDto, ProjectDto, SubmissionDto, TeamFullDto } from "@/lib/types";
import type { TalentTab } from "@/app/talent/dashboard/page";

export function ProjectsTab({ projects, applications, submissions, teams, onChanged, goTo }: {
  projects: ProjectDto[]; applications: ApplicationDto[]; submissions: SubmissionDto[]; teams: TeamFullDto[]; onChanged: () => void; goTo: (t: TalentTab) => void;
}) {
  const params = useSearchParams();
  // Deep link from the public project page: /talent/dashboard?tab=projects&apply=<projectId>
  const applyParam = params.get("apply");
  const [choice, setChoice] = useState<ProjectDto | null>(() => {
    if (!applyParam) return null;
    const p = projects.find(x => x.id === applyParam);
    const taken = applications.some(a => a.projectId === applyParam && a.status !== "WITHDRAWN") || teams.some(t => t.projectId === applyParam && !t.application);
    return p && !taken ? p : null;
  });
  const [teamName, setTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [applying, setApplying] = useState<ProjectDto | null>(null);
  const [form, setForm] = useState({ teamName: "", pitch: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter(p =>
      (category === "all" || p.category === category) &&
      (!needle || p.title.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle) || p.requiredSkills.some(s => s.toLowerCase().includes(needle)) || p.client?.name.toLowerCase().includes(needle))
    );
  }, [projects, q, category]);

  function appFor(projectId: string) {
    return applications.find(a => a.projectId === projectId && a.status !== "WITHDRAWN");
  }
  function teamFor(projectId: string) {
    return teams.find(t => t.projectId === projectId && !t.application);
  }

  function startApply(p: ProjectDto) {
    if (p.teamCap > 1) { setChoice(p); return; }
    setApplying(p); setForm({ teamName: "", pitch: "" }); setError(null);
  }

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!choice) return;
    setCreating(true); setError(null);
    const r = await api("/api/teams", "POST", { projectId: choice.id, name: teamName });
    setCreating(false);
    if (!r.ok) { setError(r.error ?? "Could not create team"); return; }
    setChoice(null); setTeamName("");
    onChanged();
    goTo("teams");
  }

  async function apply(e: React.FormEvent) {
    e.preventDefault();
    if (!applying) return;
    setBusy(true); setError(null);
    const res = await api("/api/applications", "POST", { projectId: applying.id, ...form });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Could not apply"); return; }
    setApplying(null); setForm({ teamName: "", pitch: "" });
    onChanged();
    goTo("applications");
  }

  return (
    <div>
      <SectionHeader icon="🔎" title="Find projects" subtitle="Open projects from clients. Apply to the ones that match your skills." />

      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input id="proj-search" value={q} onChange={e => setQ(e.target.value)} style={{ ...inputStyle(), flex: "1 1 240px" }} placeholder="Search by title, skill or client…" aria-label="Search projects" />
        <select id="proj-cat" value={category} onChange={e => setCategory(e.target.value)} style={{ ...selectStyle(), width: "auto", minWidth: 200 }} aria-label="Filter by category">
          <option value="all">All categories</option>
          {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{PROJECT_CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="📭" title={projects.length === 0 ? "No open projects right now" : "No projects match your search"} hint={projects.length === 0 ? "Check back soon — new projects are posted regularly." : "Try a different keyword or category."} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {visible.map(p => {
            const app = appFor(p.id);
            const sub = app ? submissions.find(s => s.teamId === app.teamId) : undefined;
            const days = daysUntil(p.deadline);
            return (
              <Card key={p.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase" }}>{PROJECT_CATEGORY_LABEL[p.category]}</span>
                    {p.featured && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: "var(--navy)", background: "var(--gold)", padding: "2px 8px", borderRadius: 6, textTransform: "uppercase" }}>★ Featured</span>}
                    <h4 style={{ fontSize: 17, fontWeight: 700, color: "var(--navy)", margin: "2px 0 4px" }}>
                      <Link href={`/projects/${p.id}`} style={{ color: "inherit", textDecoration: "none" }}>{p.title}</Link>
                    </h4>
                    {p.client && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Link href={`/clients/${p.client.id}`} style={{ fontSize: 13, fontWeight: 600, color: "var(--gold)", textDecoration: "none" }}>{p.client.name}</Link>
                        <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{p.client.clientType ? CLIENT_TYPE_LABEL[p.client.clientType] : ""}</span>
                        <VerificationBadge status={p.client.verificationStatus} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 12, color: days <= 3 ? "#9B2C2C" : "var(--ink-subtle)", whiteSpace: "nowrap", fontWeight: days <= 3 ? 700 : 400 }}>📅 {formatDate(p.deadline)} · {days} day{days !== 1 ? "s" : ""} left</span>
                </div>
                <p style={{ fontSize: 14, color: "var(--ink-muted)", margin: "0 0 12px", lineHeight: 1.6 }}>{p.description}</p>
                <div style={{ marginBottom: 14 }}><SkillChips skills={p.requiredSkills} /></div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {sub && sub.status !== "REJECTED" ? (
                    <Btn variant="ghost" small onClick={() => goTo("submissions")}>View submission</Btn>
                  ) : app?.status === "SELECTED" ? (
                    <Btn variant="success" onClick={() => goTo("submissions")}>📤 Submit deliverables</Btn>
                  ) : app ? (
                    <Btn variant="ghost" disabled>{app.status === "REJECTED" ? "Not selected" : app.status === "SHORTLISTED" ? "Shortlisted ✓" : "Application pending"}</Btn>
                  ) : teamFor(p.id) ? (
                    <Btn variant="gold" onClick={() => goTo("teams")}>👥 Continue with your team</Btn>
                  ) : (
                    <Btn onClick={() => startApply(p)}>Apply →</Btn>
                  )}
                  <span style={{ fontSize: 12, color: "var(--ink-subtle)" }}>{p.teamCap > 1 ? `Teams of up to ${p.teamCap}` : "Individuals only"} · {p._count?.applications ?? 0} applied</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {choice && (
        <Modal title={`Apply to ${choice.title}`} subtitle={`${choice.client?.name ?? "Client"} · teams of up to ${choice.teamCap}. Apply on your own, or build a team and apply together — everyone on the team earns a certificate.`} onClose={() => setChoice(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }} className="mobile-dashboard-form-grid">
            <button onClick={() => { const p = choice; setChoice(null); setApplying(p); setForm({ teamName: "", pitch: "" }); setError(null); }} style={{ textAlign: "left", padding: 16, border: "1.5px solid var(--border)", borderRadius: 12, background: "#FAFAFA", cursor: "pointer" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>🙋 Apply solo</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", marginTop: 4 }}>Just you. Quickest way to apply.</div>
            </button>
            <div style={{ padding: 16, border: "1.5px solid var(--gold)", borderRadius: 12, background: "#FFFDF5" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: "var(--navy)" }}>👥 Build a team</div>
              <div style={{ fontSize: 12, color: "var(--ink-muted)", margin: "4px 0 10px" }}>Create the team now, invite people by email, apply when everyone has joined.</div>
              <form onSubmit={createTeam} style={{ display: "flex", gap: 8 }}>
                <input id="team-name" value={teamName} onChange={e => setTeamName(e.target.value)} style={{ ...inputStyle(), flex: 1 }} placeholder="Team name" maxLength={100} required />
                <Btn type="submit" variant="gold" small disabled={creating}>{creating ? "…" : "Create"}</Btn>
              </form>
            </div>
          </div>
          {error && <Notice kind="error">{error}</Notice>}
        </Modal>
      )}

      {applying && (
        <Modal title={`Apply to ${applying.title}`} subtitle={`${applying.client?.name ?? "Client"} · deadline ${formatDate(applying.deadline)}. You are applying on your own.`} onClose={() => setApplying(null)}>
          <form onSubmit={apply} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Applicant name" required hint="How the client will see you. Your own name is fine.">
              <input id="apply-team" value={form.teamName} onChange={e => setForm({ ...form, teamName: e.target.value })} style={inputStyle()} placeholder="e.g. Ayesha Khan" maxLength={100} required autoFocus />
            </Field>
            <Field label="Pitch" required>
              <textarea id="apply-pitch" value={form.pitch} onChange={e => setForm({ ...form, pitch: e.target.value })} rows={5} style={textareaStyle()} placeholder="Why you? Relevant experience, links to similar work, how you would approach this." required />
            </Field>
            {error && <Notice kind="error">{error}</Notice>}
            <div style={{ display: "flex", gap: 10 }}>
              <Btn type="button" variant="ghost" style={{ flex: 1 }} onClick={() => setApplying(null)}>Cancel</Btn>
              <Btn type="submit" style={{ flex: 2 }} disabled={busy}>{busy ? "Sending…" : "Send application"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
