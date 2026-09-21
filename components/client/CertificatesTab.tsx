"use client";

import { useState } from "react";
import Link from "next/link";
import { Btn, Card, EmptyState, Modal, Notice, SectionHeader, SkillChips, StatusBadge, formatDate, textareaStyle } from "@/components/dashboard/ui";
import { api } from "@/components/dashboard/useDashboardData";
import type { CertificateDto } from "@/lib/types";
import { linkedInAddUrl } from "@/lib/certificate-share";

/** Certificate list shared by client (issued) and talent (earned) dashboards. */
export function CertificateGrid({ certificates, mode, onChanged }: { certificates: CertificateDto[]; mode: "issued" | "earned"; onChanged?: () => void }) {
  const [acting, setActing] = useState<{ cert: CertificateDto; status: "REVOKED" | "DISPUTED" } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!acting) return;
    if (acting.status === "REVOKED" && !confirm("Revoke this certificate? This is permanent and the public verification page will show it as revoked.")) return;
    setBusy(true); setError(null);
    const res = await api(`/api/certificates/${acting.cert.id}`, "PATCH", { status: acting.status, reason });
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Could not update certificate"); return; }
    setActing(null); setReason("");
    onChanged?.();
  }

  return (
    <>
      {error && <Notice kind="error">{error}</Notice>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {certificates.map(cert => (
          <Card key={cert.id} accent>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 32 }}>🏅</span>
              <StatusBadge status={cert.status} />
            </div>
            <h4 style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", margin: "0 0 6px" }}>{cert.title}</h4>
            <div style={{ fontSize: 13, color: "var(--ink-muted)", marginBottom: 8 }}>
              {mode === "issued" ? <>Issued to <strong>{cert.recipientName}</strong></> : <>Issued by <strong>{cert.issuerName}</strong></>} · {formatDate(cert.issuedAt)}
            </div>
            <SkillChips skills={cert.skills} max={5} />
            {cert.status !== "VERIFIED" && cert.statusReason && (
              <div style={{ marginTop: 10, fontSize: 12, color: "#9B2C2C" }}>Reason: {cert.statusReason}</div>
            )}
            <div style={{ borderTop: "1px dashed rgba(201,162,39,0.3)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--ink-subtle)" }}>{cert.certId}</span>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Link href={`/certificates/${cert.certId}`} style={{ fontSize: 11, fontWeight: 700, color: "var(--navy)", textDecoration: "none", padding: "4px 10px", border: "1px solid var(--navy)", borderRadius: 6 }}>View</Link>
                {cert.status !== "REVOKED" && (
                  <a href={`/api/certificates/${cert.id}/pdf`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "var(--navy)", textDecoration: "none", padding: "4px 10px", borderRadius: 6 }}>PDF</a>
                )}
                {mode === "earned" && cert.status === "VERIFIED" && (
                  <a href={linkedInAddUrl(typeof window === "undefined" ? "" : window.location.origin, { certId: cert.certId, title: cert.title, issuedAt: new Date(cert.issuedAt) })} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: "#0A66C2", textDecoration: "none", padding: "4px 10px", borderRadius: 6 }}>Add to LinkedIn</a>
                )}
                {mode === "issued" && cert.status === "VERIFIED" && (
                  <>
                    <button onClick={() => setActing({ cert, status: "DISPUTED" })} style={{ fontSize: 11, fontWeight: 700, color: "#97640E", background: "transparent", border: "1px solid rgba(236,201,75,0.6)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Dispute</button>
                    <button onClick={() => setActing({ cert, status: "REVOKED" })} style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "transparent", border: "1px solid rgba(229,62,62,0.4)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Revoke</button>
                  </>
                )}
                {mode === "issued" && cert.status === "DISPUTED" && (
                  <>
                    <button onClick={() => setActing({ cert, status: "REVOKED" })} style={{ fontSize: 11, fontWeight: 700, color: "#9B2C2C", background: "transparent", border: "1px solid rgba(229,62,62,0.4)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Revoke</button>
                    <button onClick={async () => { const r = await api(`/api/certificates/${cert.id}`, "PATCH", { status: "VERIFIED" }); if (!r.ok) setError(r.error ?? "Failed"); else onChanged?.(); }} style={{ fontSize: 11, fontWeight: 700, color: "#276749", background: "transparent", border: "1px solid rgba(56,161,105,0.4)", padding: "4px 10px", borderRadius: 6, cursor: "pointer" }}>Reinstate</button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {acting && (
        <Modal title={acting.status === "REVOKED" ? "Revoke certificate" : "Flag as disputed"} subtitle={`${acting.cert.certId} · ${acting.cert.recipientName}. The reason is recorded in the audit log and shown on the public verification page.`} onClose={() => setActing(null)}>
          <form onSubmit={submit}>
            <textarea id="cert-reason" rows={4} style={textareaStyle()} value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this certificate being revoked or disputed?" required autoFocus />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn type="button" variant="ghost" style={{ flex: 1 }} onClick={() => setActing(null)}>Cancel</Btn>
              <Btn type="submit" variant="danger" style={{ flex: 2 }} disabled={busy}>{acting.status === "REVOKED" ? "Revoke permanently" : "Mark as disputed"}</Btn>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

export function CertificatesTab({ certificates, onChanged }: { certificates: CertificateDto[]; onChanged: () => void }) {
  return (
    <div>
      <SectionHeader icon="🏅" title="Issued certificates" subtitle="Every certificate issued under your name. Revocations are permanent and public." />
      {certificates.length === 0 ? (
        <EmptyState icon="🎓" title="No certificates issued yet" hint="Approve a submission to issue certificates to the team." />
      ) : (
        <CertificateGrid certificates={certificates} mode="issued" onChanged={onChanged} />
      )}
    </div>
  );
}
