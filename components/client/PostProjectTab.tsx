"use client";

import { useState } from "react";
import { Btn, Field, Notice, SectionHeader, inputStyle, selectStyle, textareaStyle } from "@/components/dashboard/ui";
import { api } from "@/components/dashboard/useDashboardData";
import { PROJECT_CATEGORIES, PROJECT_CATEGORY_LABEL, TEAM_CAP_DEFAULT, TEAM_CAP_MAX, TEAM_CAP_MIN, type ProjectCategory } from "@/lib/enums";
import { PlanRequiredModal } from "@/components/client/PlanRequiredModal";

const EMPTY = { title: "", description: "", category: "" as ProjectCategory | "", requiredSkills: "", deliverables: "", deadline: "", teamCap: TEAM_CAP_DEFAULT, draft: false };

export function PostProjectTab({ clientName, onCreated, verified, billing }: { clientName: string; onCreated: () => void; verified: boolean; billing?: { canPost: boolean; reason: string; freePostsLeft: number; postsLeftInPeriod: number | null } }) {
  const [planModal, setPlanModal] = useState<"PLAN_REQUIRED" | "LIMIT_REACHED" | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const skills = form.requiredSkills.split(",").map(s => s.trim()).filter(Boolean);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    const res = await api<{ notice?: string | null; billing?: string }>("/api/projects", "POST", form);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Could not create the project"); return; }
    setForm(EMPTY);
    if (res.data?.billing === "PLAN_REQUIRED" || res.data?.billing === "LIMIT_REACHED") { setPlanModal(res.data.billing); return; }
    if (res.data?.notice) alert(res.data.notice);
    onCreated();
  }

  return (
    <div>
      <SectionHeader icon="➕" title="Post a project" subtitle="Describe the work, the skills it needs and what must be delivered. Talent will apply as individuals or teams." />
      {!verified && <Notice kind="warning">Your account isn&apos;t verified yet, so this will be saved as a <strong>draft</strong>. You can publish it as soon as verification is approved.</Notice>}
      {verified && billing && !billing.canPost && <Notice kind="warning">{billing.reason === "LIMIT_REACHED" ? "Your plan's posts for this period are used up — this will be saved as a draft until you upgrade." : "You've used your free posts — this will be saved as a draft until you choose a plan."}</Notice>}
      {verified && billing?.canPost && <Notice kind="info">{billing.reason === "FREE" ? `Publishing uses 1 of your ${billing.freePostsLeft} remaining free post${billing.freePostsLeft === 1 ? "" : "s"}.` : billing.postsLeftInPeriod === null ? "Your plan has unlimited posts." : `Publishing uses 1 of ${billing.postsLeftInPeriod} post${billing.postsLeftInPeriod === 1 ? "" : "s"} left in this period.`}</Notice>}
      {planModal && <PlanRequiredModal reason={planModal} onClose={() => { setPlanModal(null); onCreated(); }} />}
      <div style={{ height: 8 }} />
      <div className="mobile-dashboard-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24 }}>
        <form onSubmit={submit}>
          <div style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 24, marginBottom: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Project title" required>
              <input id="proj-title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={inputStyle()} placeholder="e.g. Landing page for a bakery" maxLength={200} required />
            </Field>
            <div className="mobile-dashboard-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Field label="Category" required>
                <select id="proj-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value as ProjectCategory })} style={selectStyle()} required>
                  <option value="">Choose a category</option>
                  {PROJECT_CATEGORIES.map(c => <option key={c} value={c}>{PROJECT_CATEGORY_LABEL[c]}</option>)}
                </select>
              </Field>
              <Field label="Team size" required hint={`How many people can work on it (${TEAM_CAP_MIN}–${TEAM_CAP_MAX}). 1 = individuals only.`}>
                <input id="proj-teamcap" type="number" min={TEAM_CAP_MIN} max={TEAM_CAP_MAX} value={form.teamCap} onChange={e => setForm({ ...form, teamCap: Math.max(TEAM_CAP_MIN, Math.min(TEAM_CAP_MAX, parseInt(e.target.value) || TEAM_CAP_MIN)) })} style={inputStyle()} required />
              </Field>
            </div>
            <Field label="Description" required>
              <textarea id="proj-description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={5} style={textareaStyle()} placeholder="What is the project, who is it for, and what does success look like?" required />
            </Field>
            <Field label="Required skills" required hint="Comma separated. These are printed on the certificate.">
              <input id="proj-skills" value={form.requiredSkills} onChange={e => setForm({ ...form, requiredSkills: e.target.value })} style={inputStyle()} placeholder="e.g. React, Figma, Copywriting" required />
            </Field>
            <Field label="Deliverables" required>
              <textarea id="proj-deliverables" value={form.deliverables} onChange={e => setForm({ ...form, deliverables: e.target.value })} rows={3} style={textareaStyle()} placeholder="e.g. GitHub repo link, deployed URL, and a short README" required />
            </Field>
            <Field label="Deadline" required>
              <input id="proj-deadline" type="date" min={minDate} value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} style={{ ...inputStyle(), maxWidth: 240 }} required />
            </Field>
          </div>
          {verified && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-muted)", marginBottom: 12, cursor: "pointer" }}>
              <input id="proj-draft" type="checkbox" checked={form.draft} onChange={e => setForm({ ...form, draft: e.target.checked })} />
              Save as a draft — don&apos;t publish yet (you can publish from My Projects)
            </label>
          )}
          <Btn type="submit" disabled={busy} style={{ width: "100%", padding: "14px 0", fontSize: 15 }}>{busy ? "Saving…" : verified && !form.draft && (billing?.canPost ?? true) ? "Publish project" : "Save as draft"}</Btn>
          {error && <Notice kind="error">{error}</Notice>}
        </form>

        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-subtle)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>How talent will see it</div>
          <div style={{ border: "1px solid var(--gold)", borderRadius: 14, padding: 20, background: "#FFFDF5", boxShadow: "var(--shadow-md)" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", background: "rgba(201,162,39,0.15)", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase" }}>{form.category ? PROJECT_CATEGORY_LABEL[form.category] : "Category"}</span>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", margin: "8px 0 4px" }}>{form.title || "Project title"}</h4>
            <div style={{ fontSize: 12, color: "var(--gold)", fontWeight: 600, marginBottom: 10 }}>{clientName}</div>
            <p style={{ fontSize: 13, color: "var(--ink-muted)", margin: "0 0 12px", lineHeight: 1.5 }}>{form.description || "Your description appears here as you type."}</p>
            {skills.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>{skills.map(s => <span key={s} style={{ fontSize: 11, fontWeight: 600, color: "var(--navy)", background: "rgba(15,42,74,0.07)", borderRadius: 6, padding: "3px 10px" }}>{s}</span>)}</div>}
            <div style={{ fontSize: 11, color: "var(--ink-subtle)" }}>Deadline {form.deadline || "—"} · Team size {form.teamCap}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
