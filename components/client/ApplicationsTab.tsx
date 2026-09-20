"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn, Card, EmptyState, Notice, SectionHeader, StatusBadge, VerificationBadge, formatDate, selectStyle } from "@/components/dashboard/ui";
import { api } from "@/components/dashboard/useDashboardData";
import type { ApplicationDto, ProjectDto } from "@/lib/types";

import type { ClientTab } from "@/app/client/dashboard/page";

export function ApplicationsTab({ applications, projects, onChanged, filtersEnabled, goTo }: { applications: ApplicationDto[]; projects: ProjectDto[]; onChanged: () => void; filtersEnabled?: boolean; goTo?: (t: ClientTab) => void }) {
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [skill, setSkill] = useState("");
  const [minTeam, setMinTeam] = useState(1);
  const [filter, setFilter] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = applications.filter(a => {
    if (filter !== "all" && a.projectId !== filter) return false;
    if (!filtersEnabled) return true;
    const members = a.team.members.filter(m => m.status === "ACCEPTED");
    if (verifiedOnly && !members.every(m => m.user.verificationStatus === "VERIFIED")) return false;
    if (members.length < minTeam) return false;
    if (skill.trim() && !a.pitch.toLowerCase().includes(skill.trim().toLowerCase())) return false;
    return true;
  });

  async function decide(id: string, status: "SHORTLISTED" | "SELECTED" | "REJECTED") {
    setError(null); setBusyId(id);
    const res = await api(`/api/applications/${id}`, "PATCH", { status });
    setBusyId(null);
    if (!res.ok) { setError(res.error ?? "Could not update application"); return; }
    onChanged();
  }

  return (
    <div>
      <SectionHeader icon="📋" title="Applications" subtitle="Review pitches and select the team you want to work with."
        action={projects.length > 1 ? (
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ ...selectStyle(), width: "auto", minWidth: 200 }} aria-label="Filter by project">
            <option value="all">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        ) : undefined}
      />
      {error && <Notice kind="error">{error}</Notice>}

      {filtersEnabled ? (
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 10, background: "#FAFAFA", marginBottom: 16, fontSize: 13 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1 }}>Filters</span>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}><input id="f-verified-only" type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} /> All members verified</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>Min team size <input id="f-min-team" type="number" min={1} max={20} value={minTeam} onChange={e => setMinTeam(Math.max(1, parseInt(e.target.value) || 1))} style={{ width: 60, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: 6 }} /></label>
          <input id="f-pitch" value={skill} onChange={e => setSkill(e.target.value)} placeholder="Pitch mentions… (e.g. React)" style={{ flex: "1 1 180px", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 6 }} />
        </div>
      ) : (
        <div style={{ padding: "10px 14px", border: "1px dashed var(--border)", borderRadius: 10, marginBottom: 16, fontSize: 12, color: "var(--ink-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span>Applicant filters (verified members, team size, pitch keywords) are available on the Growth and Pro plans.</span>
          {goTo && <button onClick={() => goTo("billing")} style={{ fontSize: 12, fontWeight: 700, color: "var(--navy)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>See plans</button>}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState icon="📬" title="No applications yet" hint="Applications appear here as soon as talent applies to your projects." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {visible.map(app => {
            const members = app.team.members.filter(m => m.status === "ACCEPTED");
            const busy = busyId === app.id;
            const decided = app.status === "SELECTED" || app.status === "REJECTED" || app.status === "WITHDRAWN";
            return (
              <Card key={app.id} style={{ background: "#fff" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", textTransform: "uppercase" }}>{app.project.title}</span>
                    <h4 style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)", margin: "4px 0 2px" }}>{app.team.name}</h4>
                    <div style={{ fontSize: 12, color: "var(--ink-subtle)" }}>Applied {formatDate(app.createdAt)} · {members.length} member{members.length !== 1 ? "s" : ""}</div>
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                  {members.map(m => (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
                      <Link href={`/talents/${m.user.id}`} style={{ fontWeight: 700, color: "var(--navy)", textDecoration: "none" }}>{m.user.name}</Link>
                      <span style={{ fontSize: 11, color: "var(--ink-subtle)" }}>{m.role === "LEAD" ? "Team lead" : "Member"}</span>
                      <VerificationBadge status={m.user.verificationStatus} />
                    </div>
                  ))}
                </div>

                <div style={{ padding: 14, background: "#F8FAFC", borderRadius: 10, borderLeft: "3px solid var(--navy)", marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase" }}>Pitch</div>
                  <p style={{ fontSize: 13, color: "var(--ink)", margin: "4px 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{app.pitch}</p>
                </div>

                {!decided && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Btn variant="success" disabled={busy} onClick={() => decide(app.id, "SELECTED")}>✓ Select this team</Btn>
                    {app.status !== "SHORTLISTED" && <Btn disabled={busy} style={{ background: "#3182CE" }} onClick={() => decide(app.id, "SHORTLISTED")}>Shortlist</Btn>}
                    <Btn variant="outline" disabled={busy} onClick={() => decide(app.id, "REJECTED")}>Reject</Btn>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
