"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/Button";

type CertificateStatus = "VERIFIED" | "REVOKED" | "DISPUTED";

interface Certificate {
  certId: string;
  recipientName: string;
  issuerName: string;
  issuerType: "INDIVIDUAL" | "ORGANIZATION";
  projectTitle: string;
  skills: string[];
  issuedAt: string;
  status: CertificateStatus;
  statusReason: string | null;
  signatureValid: boolean;
  fingerprint: string | null;
}

interface VerifyResponse {
  certificate: {
    certId: string;
    title: string;
    recipientName: string;
    issuerName: string;
    issuerType: "INDIVIDUAL" | "ORGANIZATION";
    skills: string[];
    issuedAt: string;
    status: string;
    statusReason: string | null;
    signatureValid: boolean;
    fingerprint?: string;
  };
}

const STATUS_STYLES: Record<CertificateStatus, { banner: string; icon: string; label: string; title: string }> = {
  VERIFIED: {
    banner: "bg-green-50 border-green-200",
    icon: "bg-green-100 text-green-600 border-green-200",
    label: "bg-green-100 text-green-800 border-green-200",
    title: "This certificate is genuine",
  },
  REVOKED: {
    banner: "bg-red-50 border-red-200",
    icon: "bg-red-100 text-red-600 border-red-200",
    label: "bg-red-100 text-red-800 border-red-200",
    title: "This certificate has been revoked by the issuer",
  },
  DISPUTED: {
    banner: "bg-amber-50 border-amber-200",
    icon: "bg-amber-100 text-amber-700 border-amber-200",
    label: "bg-amber-100 text-amber-800 border-amber-200",
    title: "This certificate is under dispute",
  },
};

function toStatus(value: string): CertificateStatus {
  return value === "REVOKED" || value === "DISPUTED" ? value : "VERIFIED";
}

export default function VerifyPage() {
  // Prefilled from /verify?id=CERT-… (linked from certificate pages and QR codes).
  const [certId, setCertId] = useState(() => (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("id") ?? ""));
  const [result, setResult] = useState<Certificate | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (raw: string) => {
    const query = raw.trim().toUpperCase();
    if (!query) return;
    setLoading(true);
    setSearched(false);
    setError(null);

    try {
      const res = await fetch(`/api/verify/${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = (await res.json()) as VerifyResponse;
        const c = data.certificate;
        setResult({
          certId: c.certId,
          recipientName: c.recipientName,
          issuerName: c.issuerName,
          issuerType: c.issuerType,
          projectTitle: c.title,
          skills: c.skills ?? [],
          issuedAt: new Date(c.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
          status: toStatus(c.status),
          statusReason: c.statusReason ?? null,
          signatureValid: c.signatureValid !== false,
          fingerprint: c.fingerprint ?? null,
        });
      } else {
        setResult(null);
        if (res.status === 429) setError("Too many lookups from your network. Please try again in a little while.");
      }
    } catch (err) {
      console.error(err);
      setResult(null);
      setError("Could not reach the verification service. Check your connection and try again.");
    } finally {
      setSearched(true);
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); void lookup(certId); };

  // Arriving from a QR code or a certificate link: verify immediately.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("id");
    if (fromUrl) { const t = setTimeout(() => { void lookup(fromUrl); }, 0); return () => clearTimeout(t); }
  }, [lookup]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page Header */}
      <section className="bg-navy-dark text-paper py-20 sm:py-28 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#C9A227_1px,transparent_1px),linear-gradient(to_bottom,#C9A227_1px,transparent_1px)] bg-[size:5rem_5rem]"></div>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 relative z-10">
          <div className="max-w-4xl">
            <p className="mb-8 flex items-center gap-3 text-xs font-mono uppercase tracking-[0.2em] text-gold"><span className="h-px w-10 bg-gold" /> Public verification</p>
            <h1 className="text-5xl sm:text-7xl font-black leading-[0.98] tracking-[-0.04em]">Check the <span className="text-gold">record.</span></h1>
            <p className="mt-8 text-lg max-w-2xl text-paper/75 leading-relaxed sm:text-xl">A CertiTask certificate is a signed record of work. Enter its ID to see who did it, who reviewed it, and whether it is still valid.</p>
          </div>
        </div>
      </section>

      {/* Verification Query Tool */}
      <section className="py-20 sm:py-28 bg-paper text-ink flex-1">
        <div className="max-w-5xl mx-auto px-6 sm:px-10 space-y-12">
          {/* Lookup Input Form */}
          <div className="bg-white p-6 sm:p-10 border-y border-navy/15 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-28 h-1.5 bg-gold"></div>
            
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="certificateId" className="block text-xs font-bold text-navy/85 uppercase tracking-[0.16em]">
                  Certificate ID
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    id="certificateId"
                    value={certId}
                    onChange={(e) => setCertId(e.target.value)}
                    placeholder="CERT-XXXX-XXXX-XXXX"
                    className="block w-full px-4 py-4 bg-paper border border-navy/20 rounded-none text-ink font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
                  />
                  <Button type="submit" variant="primary" className="py-3 px-8 shrink-0 rounded-none" disabled={loading}>
                    {loading ? "Checking..." : "Check record"}
                  </Button>
                </div>
                <p className="text-[11px] text-ink/50 leading-normal">
                  The ID is printed on the certificate PDF and on its public certificate page.
                </p>
              </div>
            </form>
          </div>

          {/* Results Panel */}
          {searched && (
            <div className="bg-white p-6 sm:p-10 border-y border-navy/15 relative overflow-hidden transition-all duration-300">
              {result ? (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 p-5 border ${STATUS_STYLES[result.status].banner}`}>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center border shadow-xs shrink-0 ${STATUS_STYLES[result.status].icon}`}>
                        {result.status === "VERIFIED" ? (
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        ) : (
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-navy/70">Verification result</p>
                        <p className="text-sm font-bold text-navy mt-0.5">{STATUS_STYLES[result.status].title}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 border rounded-full text-xs font-bold uppercase shrink-0 ${STATUS_STYLES[result.status].label}`}>
                      {result.status.toLowerCase()}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-navy/5">
                    <div>
                      <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide">Recipient</p>
                      <p className="text-base font-bold text-navy mt-1">{result.recipientName}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide">Issued by</p>
                      <p className="text-base font-bold text-navy mt-1">{result.issuerName}</p>
                      <p className="text-xs text-ink/60 mt-0.5">{result.issuerType === "ORGANIZATION" ? "Organization" : "Individual"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide">Project</p>
                      <p className="text-sm font-semibold text-ink mt-1">{result.projectTitle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide">Date issued</p>
                      <p className="text-sm font-semibold text-ink mt-1">{result.issuedAt}</p>
                    </div>
                    {result.skills.length > 0 && (
                      <div className="sm:col-span-2">
                        <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide mb-1">Skills demonstrated</p>
                        <div className="flex flex-wrap gap-1.5">
                          {result.skills.map(sk => <span key={sk} className="px-2 py-0.5 rounded bg-navy/5 text-navy text-[11px] font-semibold border border-navy/10">{sk}</span>)}
                        </div>
                      </div>
                    )}
                    {result.status !== "VERIFIED" && result.statusReason && (
                      <div className="sm:col-span-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
                        <span className="font-bold">Reason given by the issuer:</span> {result.statusReason}
                      </div>
                    )}
                    {!result.signatureValid && (
                      <div className="sm:col-span-2 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
                        <span className="font-bold">Integrity check failed.</span> The stored record does not match its signature. Treat this certificate as unverified and contact support.
                      </div>
                    )}
                  </div>

                  {/* Certificate ID + signature fingerprint */}
                  <div className="pt-6 border-t border-navy/5 bg-paper/50 p-4 rounded-lg">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide mb-1">Certificate ID</p>
                        <p className="text-xs font-mono text-ink/75 break-all leading-normal bg-white p-2.5 rounded border border-navy/5">{result.certId}</p>
                      </div>
                      {result.fingerprint && (
                        <div>
                          <p className="text-[10px] font-bold text-navy/60 uppercase tracking-wide mb-1">Digital signature fingerprint</p>
                          <p className="text-xs font-mono text-ink/75 break-all leading-normal bg-white p-2.5 rounded border border-navy/5" title="HMAC-SHA256 signature computed by CertiTask over the certificate's immutable fields">{result.fingerprint}</p>
                          <p className="text-[11px] text-ink/60 mt-1">Must match the fingerprint printed on the PDF.</p>
                        </div>
                      )}
                    </div>
                    <a href={`/certificates/${encodeURIComponent(result.certId)}`} className="inline-block mt-3 text-xs font-bold text-navy underline underline-offset-2">
                      Open the certificate page
                    </a>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 space-y-4">
                  <div className="h-12 w-12 bg-red-50 text-red-500 border border-red-200 rounded-full flex items-center justify-center mx-auto shadow-xs shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-sans font-bold text-lg text-navy">{error ? "Verification unavailable" : "Certificate ID not found"}</h3>
                    <p className="text-sm text-ink/70 max-w-md mx-auto mt-1">
                      {error ?? (
                        <>
                          The ID <span className="font-mono font-bold text-red-600">&ldquo;{certId}&rdquo;</span> does not match any certificate in our records. Check the characters and dashes and try again.
                        </>
                      )}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
