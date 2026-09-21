"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ── SVG Icons ─────────────────────────────────────────────────── */
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

function BuildingIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 16, height: 16 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
    </svg>
  );
}

function GradCapIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" style={{ width: 16, height: 16 }}>
      <path d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();

  const [role, setRole] = useState<"company" | "student">("company");
  const [role, setRole] = useState<"client" | "talent">("talent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        setLoading(false);
        return;
      }

      // Redirect based on user role from Neon DB or selected tab
      const destRole = data.user?.role || role;
      router.push(destRole === "student" ? "/student/dashboard" : "/company/dashboard");
      const next = new URLSearchParams(window.location.search).get("next");
      if (destRole === "admin") router.push("/admin/dashboard");
      else if (next && next.startsWith("/") && !next.startsWith("//")) router.push(next);
      else router.push(destRole === "talent" ? "/talent/dashboard" : "/client/dashboard");
      router.refresh();
    } catch {
      setError("An error occurred during sign in. Please try again.");
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
            <Image
              src="/app-icon-128.png"
              alt="CertiTask"
              width={44}
              height={44}
              className="brand-logo-img"
            />
            <span className="brand-wordmark">
              Certi<span>Task</span>
            </span>
          </div>

          <div>
            <h1 className="brand-headline">
              Certifications,<br />
              <em>Simplified.</em>
            </h1>
            <p className="brand-sub">
              The platform that connects companies and students through
              seamless certification management and task tracking.
              Real projects from clients, real proof for talent. Sign in to
              post work, do work, or manage your certificates.
            </p>
          </div>

          <div className="brand-features">
            {[
              "Issue & verify certificates instantly",
              "Track compliance deadlines effortlessly",
              "Unified dashboard for teams and learners",
              "Bank-grade security for your credentials",
            ].map((f) => (
              <div className="brand-feature-item" key={f}>
                <span className="brand-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>

        <p className="brand-footer">
          © {new Date().getFullYear()} CertiTask. All rights reserved.
        </p>
      </aside>

      {/* ── Form Panel ──────────────────────────────────────── */}
      <div className="auth-form-panel">
        <div className="auth-form-inner">
          {/* Mobile logo */}
          <div className="auth-mobile-logo">
            <Image src="/app-icon-128.png" alt="CertiTask" width={36} height={36} />
            <span>
              Certi<em>Task</em>
            </span>
          </div>

          <div className="auth-card">
            <h2 className="auth-heading">Welcome back</h2>
            <p className="auth-sub">Sign in to your account to continue</p>

            {/* Role tabs */}
            <div className="role-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                className={`role-tab${role === "company" ? " active" : ""}`}
                onClick={() => setRole("company")}
                aria-selected={role === "company"}
                id="tab-company-login"
                className={`role-tab${role === "client" ? " active" : ""}`}
                onClick={() => setRole("client")}
                aria-selected={role === "client"}
                id="tab-client-login"
              >
                <BuildingIcon />
                Company
                Client
              </button>
              <button
                type="button"
                role="tab"
                className={`role-tab${role === "student" ? " active" : ""}`}
                onClick={() => setRole("student")}
                aria-selected={role === "student"}
                id="tab-student-login"
                className={`role-tab${role === "talent" ? " active" : ""}`}
                onClick={() => setRole("talent")}
                aria-selected={role === "talent"}
                id="tab-talent-login"
              >
                <GradCapIcon />
                Student
                Talent
              </button>
            </div>

            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email address
                </label>
                <div className="input-wrap">
                  <span className="input-icon">
                    <MailIcon />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    className={`form-input${error ? " has-error" : ""}`}
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="form-group">
                <div className="flex items-center justify-between">
                  <label className="form-label" htmlFor="login-password">
                    Password
                  </label>
                  <Link href="/auth/forgot-password" className="forgot-link">
                    Forgot password?
                  </Link>
                </div>
                <div className="input-wrap">
                  <span className="input-icon">
                    <LockIcon />
                  </span>
                  <input
                    id="login-password"
                    type={showPass ? "text" : "password"}
                    className={`form-input${error ? " has-error" : ""}`}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="input-btn"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                  >
                    <EyeIcon visible={showPass} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="field-error mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" style={{ width: 14, height: 14, flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                id="login-submit"
                className={`btn-primary mt-4${loading ? " loading" : ""}`}
                disabled={loading || !email || !password}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Signing in…
                  </>
                ) : (
                  `Sign in as ${role === "company" ? "Company" : "Student"}`
                  `Sign in as ${role === "client" ? "client" : "talent"}`
                )}
              </button>
            </form>
          </div>

          <p className="auth-nav-text">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="auth-link">
              Create account
            </Link>
          </p>
          <p className="auth-nav-text mt-2">
            Administrator?{" "}
            <Link href="/admin/login" className="auth-link">
              Use the admin portal
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
