"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ── Icons ──────────────────────────────────────────────────────── */
function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 18, height: 18 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 18, height: 18 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function BuildingIcon({ size = 22 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: size, height: size }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function GradCapIcon({ size = 22 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: size, height: size }}>
      <path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function getPasswordStrength(pwd: string): { level: number; label: string } {
  if (!pwd) return { level: 0, label: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const labels = ["", "Weak", "Fair", "Good", "Strong"];
  return { level: score, label: labels[score] };
}

const STRENGTH_CLASS = ["", "weak", "fair", "good", "strong"];

export default function SignupPage() {
  const router = useRouter();

  const [role, setRole] = useState<"company" | "student">("company");
  const [role, setRole] = useState<"client" | "talent">("talent");
  const [clientType, setClientType] = useState<"INDIVIDUAL" | "ORGANIZATION">("INDIVIDUAL");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = getPasswordStrength(password);

  function resetFormState() {
    setFullName("");
    setEmail("");
    setPassword("");
    setConfirm("");
    setShowPass(false);
    setShowConfirm(false);
    setLoading(false);
    setErrors({});
  }

  function handleRoleChange(nextRole: "company" | "student") {
    setRole(nextRole);
    resetFormState();
  }

  function validate() {
    const errs: Record<string, string> = {};
    if (!fullName.trim()) errs.fullName = "Full name is required";
    if (!email) errs.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Invalid email address";
    if (!password) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "At least 8 characters required";
    if (password !== confirm) errs.confirm = "Passwords do not match";
    return errs;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    setErrors({});

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName, role }),
        body: JSON.stringify({ email, password, fullName, role, clientType: role === "client" ? clientType : undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrors({ general: data.error || "Failed to create account." });
        setLoading(false);
        return;
      }

      router.push(role === "company" ? "/company/dashboard" : "/student/dashboard");
      router.push(role === "client" ? "/client/dashboard" : "/talent/dashboard");
      router.refresh();
    } catch {
      setErrors({ general: "An error occurred during account creation. Please try again." });
      setLoading(false);
    }
  }

  return (
    <div className="auth-root">
      {/* ── Brand Panel ─────────────────────────────────────── */}
      <aside className="auth-brand-panel">
        <div className="brand-orb brand-orb-1" />
        <div className="brand-orb brand-orb-2" />

        <div className="brand-content">
          <div className="brand-logo-wrap">
            <Image src="/app-icon-128.png" alt="CertiTask" width={44} height={44} className="brand-logo-img" />
            <span className="brand-wordmark">Certi<span>Task</span></span>
          </div>

          <div>
            <h1 className="brand-headline">
              Join the<br />
              <em>Future</em> of<br />
              Certification.
            </h1>
            <p className="brand-sub">
              Whether you&apos;re a company managing compliance or a student
              building credentials, CertiTask has you covered.
              Post real work and issue certificates, or do the work and
              earn credentials anyone can verify.
            </p>
          </div>

          <div className="brand-features">
            {[
              "Free to get started, no credit card needed",
              "Set up your profile in under 2 minutes",
              "Trusted by 500+ organizations",
              "ISO-compliant certificate storage",
            ].map((f) => (
              <div className="brand-feature-item" key={f}>
                <span className="brand-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="brand-footer">© {new Date().getFullYear()} CertiTask. All rights reserved.</p>
      </aside>

      {/* ── Form Panel ──────────────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          <div className="auth-mobile-logo">
            <Image src="/app-icon-128.png" alt="CertiTask" width={36} height={36} />
            <span>Certi<em>Task</em></span>
          </div>

          <div className="auth-card">
            <h2 className="auth-heading">Create your account</h2>
            <p className="auth-sub">Choose your role to get started</p>
            <p className="auth-sub">What brings you to CertiTask?</p>

            {/* Role cards */}
            <div className="role-cards">
              <button
                type="button"
                id="role-company"
                className={`role-card${role === "company" ? " selected" : ""}`}
                onClick={() => handleRoleChange("company")}
                id="role-talent"
                className={`role-card${role === "talent" ? " selected" : ""}`}
                onClick={() => setRole("talent")}
                aria-pressed={role === "talent"}
              >
                <div className="role-card-icon">
                  <BuildingIcon size={22} />
                  <GradCapIcon size={22} />
                </div>
                <span className="role-card-label">Company</span>
                <span className="role-card-desc">Issue & manage certifications for your team</span>
                <span className="role-card-label">Talent</span>
                <span className="role-card-desc">Do real projects and earn verifiable certificates</span>
              </button>

              <button
                type="button"
                id="role-student"
                className={`role-card${role === "student" ? " selected" : ""}`}
                onClick={() => handleRoleChange("student")}
                id="role-client"
                className={`role-card${role === "client" ? " selected" : ""}`}
                onClick={() => setRole("client")}
                aria-pressed={role === "client"}
              >
                <div className="role-card-icon">
                  <GradCapIcon size={22} />
                  <BuildingIcon size={22} />
                </div>
                <span className="role-card-label">Student</span>
                <span className="role-card-desc">Earn & showcase your certifications</span>
                <span className="role-card-label">Client</span>
                <span className="role-card-desc">Post projects and issue certificates for completed work</span>
              </button>
            </div>

            {role === "client" && (
              <div className="role-cards" style={{ marginTop: 10 }} role="radiogroup" aria-label="Client type">
                <button type="button" id="client-individual" className={`role-card${clientType === "INDIVIDUAL" ? " selected" : ""}`} onClick={() => setClientType("INDIVIDUAL")} role="radio" aria-checked={clientType === "INDIVIDUAL"}>
                  <span className="role-card-label">Individual</span>
                  <span className="role-card-desc">I&apos;m posting as myself. Verified with a government ID.</span>
                </button>
                <button type="button" id="client-organization" className={`role-card${clientType === "ORGANIZATION" ? " selected" : ""}`} onClick={() => setClientType("ORGANIZATION")} role="radio" aria-checked={clientType === "ORGANIZATION"}>
                  <span className="role-card-label">Organization</span>
                  <span className="role-card-desc">A company, startup, NGO or institute. Verified with registration documents.</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* General error */}
              {errors.general && (
                <div className="field-error mb-4">{errors.general}</div>
              )}

              {/* Full Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">Full name</label>
                <label className="form-label" htmlFor="signup-name">{role === "client" && clientType === "ORGANIZATION" ? "Organization name" : "Full name"}</label>
                <div className="input-wrap">
                  <span className="input-icon"><UserIcon /></span>
                  <input
                    id="signup-name"
                    type="text"
                    className={`form-input${errors.fullName ? " has-error" : ""}`}
                    placeholder="Jane Smith"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                {errors.fullName && <span className="field-error">{errors.fullName}</span>}
              </div>

              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">Email address</label>
                <div className="input-wrap">
                  <span className="input-icon"><MailIcon /></span>
                  <input
                    id="signup-email"
                    type="email"
                    className={`form-input${errors.email ? " has-error" : ""}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                {errors.email && <span className="field-error">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">Password</label>
                <div className="input-wrap">
                  <span className="input-icon"><LockIcon /></span>
                  <input
                    id="signup-password"
                    type={showPass ? "text" : "password"}
                    className={`form-input${errors.password ? " has-error" : ""}`}
                    placeholder="Min. 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="input-btn" onClick={() => setShowPass(v => !v)}>
                    <EyeIcon visible={showPass} />
                  </button>
                </div>
                {password && (
                  <>
                    <div className="password-strength">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`strength-bar${i <= strength.level ? ` ${STRENGTH_CLASS[strength.level]}` : ""}`}
                        />
                      ))}
                    </div>
                    {strength.label && (
                      <span className="strength-label">{strength.label} password</span>
                    )}
                  </>
                )}
                {errors.password && <span className="field-error">{errors.password}</span>}
              </div>

              {/* Confirm Password */}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-confirm">Confirm password</label>
                <div className="input-wrap">
                  <span className="input-icon"><LockIcon /></span>
                  <input
                    id="signup-confirm"
                    type={showConfirm ? "text" : "password"}
                    className={`form-input${errors.confirm ? " has-error" : ""}`}
                    placeholder="Re-enter your password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" className="input-btn" onClick={() => setShowConfirm(v => !v)}>
                    <EyeIcon visible={showConfirm} />
                  </button>
                </div>
                {errors.confirm && <span className="field-error">{errors.confirm}</span>}
              </div>

              <button
                type="submit"
                id="signup-submit"
                className={`btn-primary mt-4${loading ? " loading" : ""}`}
                disabled={loading}
              >
                {loading ? (
                  <><span className="spinner" />Creating account…</>
                ) : (
                  `Create ${role === "company" ? "Company" : "Student"} Account`
                  `Create ${role === "client" ? "client" : "talent"} account`
                )}
              </button>

              <p style={{ fontSize: 12, color: "var(--ink-subtle)", textAlign: "center", marginTop: 12, lineHeight: 1.6 }}>
                By creating an account you agree to our{" "}
                <a href="#" className="auth-link" style={{ fontSize: 12 }}>Terms of Service</a>
                {" "}and{" "}
                <a href="#" className="auth-link" style={{ fontSize: 12 }}>Privacy Policy</a>.
              </p>
            </form>
          </div>

          <p className="auth-nav-text">
            Already have an account?{" "}
            <Link href="/auth/login" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
