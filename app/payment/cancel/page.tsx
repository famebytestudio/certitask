import Link from "next/link";

export default function PaymentCancelPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", padding: 20 }}>
      <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 16, padding: 36, maxWidth: 460, width: "100%", textAlign: "center", boxShadow: "var(--shadow-md)" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>↩️</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--navy)", margin: "0 0 8px" }}>Payment cancelled</h1>
        <p style={{ color: "var(--ink-muted)", fontSize: 14, margin: "0 0 20px" }}>Nothing was charged. Your projects stay as drafts until you choose a plan.</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/client/dashboard?tab=billing" style={{ display: "inline-block", padding: "10px 22px", background: "var(--navy)", color: "#fff", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Choose a plan</Link>
          <Link href="/client/dashboard" style={{ display: "inline-block", padding: "10px 22px", border: "1px solid var(--border)", color: "var(--navy)", borderRadius: 8, fontWeight: 700, textDecoration: "none", fontSize: 14 }}>Back to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
