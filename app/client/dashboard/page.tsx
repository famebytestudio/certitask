"use client";

import { Suspense } from "react";
import { DashboardShell, EmailBanner, LoadingScreen, SidebarStats, type TabDef } from "@/components/dashboard/DashboardShell";
import { VerificationTab } from "@/components/dashboard/VerificationTab";
import { VerificationBadge } from "@/components/dashboard/ui";
import { signOut, useDashboardData, useTabParam } from "@/components/dashboard/useDashboardData";
import { CLIENT_TYPE_LABEL } from "@/lib/enums";
import { OverviewTab } from "@/components/client/OverviewTab";
import { PostProjectTab } from "@/components/client/PostProjectTab";
import { ProjectsTab } from "@/components/client/ProjectsTab";
import { ApplicationsTab } from "@/components/client/ApplicationsTab";
import { SubmissionsTab } from "@/components/client/SubmissionsTab";
import { CertificatesTab } from "@/components/client/CertificatesTab";
import { ProfileTab } from "@/components/client/ProfileTab";
import { BillingTab } from "@/components/client/BillingTab";

const TAB_IDS = ["overview", "post-project", "projects", "applications", "submissions", "certificates", "verification", "billing", "profile"] as const;
export type ClientTab = (typeof TAB_IDS)[number];

function ClientDashboard() {
  const { data, loading, error, refresh } = useDashboardData();
  const [tab, setTab] = useTabParam<ClientTab>(TAB_IDS, "overview");

  if (loading) return <LoadingScreen text="Loading your client workspace…" />;
  if (error || !data) return <LoadingScreen text={error ?? "Something went wrong."} />;

  const { profile, projects, applications, submissions, certificates } = data;
  const pendingApps = applications.filter(a => a.status === "PENDING" || a.status === "SHORTLISTED").length;
  const reviewQueue = submissions.filter(s => s.status === "SUBMITTED").length;
  const activeProjects = projects.filter(p => p.status === "ACTIVE").length;

  const tabs: TabDef<ClientTab>[] = [
    { id: "overview",     label: "Overview",          icon: "🏠" },
    { id: "post-project", label: "Post a Project",    icon: "➕" },
    { id: "projects",     label: "My Projects",       icon: "🚀", badge: activeProjects },
    { id: "applications", label: "Applications",      icon: "📋", badge: pendingApps },
    { id: "submissions",  label: "Review Submissions", icon: "📤", badge: reviewQueue, badgeColor: "#E53E3E" },
    { id: "certificates", label: "Issued Certificates", icon: "🏅" },
    { id: "verification", label: "Verification",      icon: "🪪", badge: profile.verificationStatus === "VERIFIED" ? 0 : 1, badgeColor: profile.verificationStatus === "PENDING_REVIEW" ? "#97640E" : "#E53E3E" },
    { id: "billing",      label: "Billing & Plan",    icon: "💳" },
    { id: "profile",      label: "Edit Profile",      icon: "✏️" },
  ];

  return (
    <DashboardShell
      navId="client-dashboard-navigation"
      workspaceLabel="Client Workspace"
      userName={profile.name}
      userSubline={profile.clientType ? CLIENT_TYPE_LABEL[profile.clientType] : profile.email}
      userBadge={<VerificationBadge status={profile.verificationStatus} />}
      tabs={tabs}
      activeTab={tab}
      onTabChange={setTab}
      onSignOut={signOut}
      banner={<EmailBanner email={profile.email} verified={!!profile.emailVerifiedAt} onVerify={() => setTab("verification")} />}
      headerActions={
        <>
          <button onClick={() => setTab("post-project")} style={{ marginLeft: 8, padding: "6px 14px", background: "var(--gold)", color: "var(--navy)", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Post project</button>
          <button onClick={() => setTab("profile")} style={{ padding: "6px 14px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Edit profile</button>
        </>
      }
      sidebarExtra={
        <SidebarStats title="Summary" rows={[
          { label: "Active projects", value: activeProjects },
          { label: "Applications", value: applications.length, color: "#3182CE" },
          { label: "Review queue", value: reviewQueue, color: reviewQueue > 0 ? "#E53E3E" : "var(--ink-subtle)" },
          { label: "Certificates", value: certificates.length, color: "var(--success)" },
        ]} />
      }
    >
      {tab === "overview"     && <OverviewTab data={data} goTo={setTab} onChanged={refresh} />}
      {tab === "post-project" && <PostProjectTab clientName={profile.name} verified={profile.verificationStatus === "VERIFIED"} billing={data.entitlement ?? undefined} onCreated={() => { void refresh(); setTab("projects"); }} />}
      {tab === "projects"     && <ProjectsTab projects={projects} applications={applications} goTo={setTab} onChanged={refresh} verified={profile.verificationStatus === "VERIFIED"} features={data.entitlement?.features} />}
      {tab === "applications" && <ApplicationsTab applications={applications} projects={projects} onChanged={refresh} filtersEnabled={!!data.entitlement?.features.applicantFilters} goTo={setTab} />}
      {tab === "submissions"  && <SubmissionsTab submissions={submissions} onChanged={refresh} />}
      {tab === "certificates" && <CertificatesTab certificates={certificates} onChanged={refresh} />}
      {tab === "verification" && <VerificationTab profile={profile} onChanged={refresh} />}
      {tab === "billing"      && <BillingTab onChanged={refresh} />}
      {tab === "profile"      && <ProfileTab profile={profile} onSaved={refresh} />}
    </DashboardShell>
  );
}

export default function ClientDashboardPage() {
  return (
    <Suspense fallback={<LoadingScreen text="Loading your client workspace…" />}>
      <ClientDashboard />
    </Suspense>
  );
}
