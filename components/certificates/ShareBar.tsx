"use client";

import { useState } from "react";

const btn = (bg: string, color: string): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", background: bg, color, borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none", border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(7,32,59,0.12)",
});

/**
 * Share / export actions under a certificate. `pdfHref` is only passed for the
 * recipient, issuer or admin; everyone else gets the public links.
 */
export function ShareBar({ pageUrl, linkedInUrl, pdfHref, valid }: { pageUrl: string; linkedInUrl: string; pdfHref: string | null; valid: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(pageUrl); } catch { window.prompt("Copy this link", pageUrl); }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="no-print" style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
      <button onClick={copy} style={btn("#fff", "#07203b")} aria-live="polite">{copied ? "✓ Link copied" : "🔗 Copy link"}</button>
      {valid && <a href={linkedInUrl} target="_blank" rel="noopener noreferrer" style={btn("#0A66C2", "#fff")}>in&nbsp; Add to LinkedIn</a>}
      {pdfHref && valid && <a href={pdfHref} style={btn("#07203b", "#fff")}>📥 Download PDF</a>}
      <button onClick={() => window.print()} style={btn("#D4A017", "#07203b")}>🖨 Print</button>
    </div>
  );
}
