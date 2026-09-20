"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, statusLabel } from "@/lib/enums";
import { VerificationQueue } from "@/components/admin/VerificationQueue";
import { PaymentsPanel } from "@/components/admin/PaymentsPanel";

function UserStatus({ clientType, verificationStatus, suspendedAt }: { clientType: string | null; verificationStatus: string; suspendedAt: string | null }) {
  return (
    <div className="flex flex-wrap gap-1">
      {clientType && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700">{clientType === "ORGANIZATION" ? "Org" : "Individual"}</span>}
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${verificationStatus === "VERIFIED" ? "bg-green-100 text-green-700" : verificationStatus === "PENDING_REVIEW" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"}`}>
        {statusLabel(verificationStatus)}
      </span>
      {suspendedAt && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-100 text-red-700">Suspended</span>}
    </div>
  );
}

// ── Types ──
interface Overview {
  clients: number;
  talents: number;
  projects: number;
  activeProjects: number;
  pendingVerifications: number;
  applications: number;
  submissionsThisWeek: number;
  certificatesIssued: number;
  certificatesRevoked: number;
  unreadMessages: number;
  totalMessages: number;
}

interface Client {
  id: string;
  name: string;
  email: string;
  clientType: "INDIVIDUAL" | "ORGANIZATION" | null;
  verificationStatus: string;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  website: string | null;
  createdAt: string;
  _count: { projectsPosted: number; certificatesIssued: number };
}

interface Talent {
  id: string;
  name: string;
  email: string;
  verificationStatus: string;
  emailVerifiedAt: string | null;
  suspendedAt: string | null;
  universityName: string | null;
  createdAt: string;
  _count: { teamMemberships: number; certificatesEarned: number };
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  client: { id: string; name: string; email: string; clientType: string | null };
  _count: { applications: number; submissions: number; certificates: number };
}

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  type: string;
  priority?: boolean;
  isRead: boolean;
  createdAt: string;
}

type Tab = "overview" | "verifications" | "clients" | "talents" | "projects" | "payments" | "messages";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  // Data states
  const [overview, setOverview] = useState<Overview | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [talents, setTalents] = useState<Talent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState("");

  // Edit states
  const [editingUser, setEditingUser] = useState<Client | Talent | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserSuspended, setEditUserSuspended] = useState(false);

  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectTitle, setEditProjectTitle] = useState("");
  const [editProjectStatus, setEditProjectStatus] = useState("ACTIVE");

  const fetchAll = useCallback(async function fetchAll() {
    setLoading(true);
    setError("");
    try {
      const [ovRes, usRes, projRes, msgRes] = await Promise.all([
        fetch("/api/admin/overview"),
        fetch("/api/admin/users"),
        fetch("/api/admin/projects"),
        fetch("/api/admin/messages"),
      ]);

      const responses = [ovRes, usRes, projRes, msgRes];
      if (responses.some((response) => response.status === 401 || response.status === 403)) {
        setError("Unauthorized. Please login as Super Admin.");
        router.push("/admin/login");
        return;
      }

      if (responses.some((response) => !response.ok)) {
        throw new Error("Admin data request failed");
      }

      const ovData = await ovRes.json();
      const usData = await usRes.json();
      const projData = await projRes.json();
      const msgData = await msgRes.json();

      setOverview(ovData.counts);
      setClients(usData.clients || []);
      setTalents(usData.talents || []);
      setProjects(projData.projects || []);
      setMessages(msgData.messages || []);
    } catch {
      setError("Failed to load admin data.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    async function loadDashboard() {
      await fetchAll();
    }

    void loadDashboard();
  }, [fetchAll]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function showSuccess(msg: string) {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(""), 3000);
  }

  // ── CRUD Actions ──

  async function deleteUser(id: string, type: "client" | "talent") {
    if (!window.confirm(`Delete this ${type} account permanently? Accounts holding certificates cannot be deleted; suspend them instead.`)) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (type === "client") setClients((prev) => prev.filter((c) => c.id !== id));
        else setTalents((prev) => prev.filter((s) => s.id !== id));
        showSuccess(`${type} deleted successfully.`);
      } else {
        const data = await res.json();
        alert(data.error || `Failed to delete ${type}`);
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function saveUserEdit() {
    if (!editingUser) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editUserName, suspended: editUserSuspended }),
      });
      if (res.ok) {
        // Update local state
        const suspendedAt = editUserSuspended ? new Date().toISOString() : null;
        setClients((prev) => prev.map((c) => c.id === editingUser.id ? { ...c, name: editUserName, suspendedAt } : c));
        setTalents((prev) => prev.map((s) => s.id === editingUser.id ? { ...s, name: editUserName, suspendedAt } : s));
        setEditingUser(null);
        showSuccess("User updated successfully.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update user");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function deleteProject(id: string) {
    if (!window.confirm("Are you sure you want to delete this project?")) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        showSuccess("Project deleted successfully.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete project");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsActionLoading(false);
    }
  }

  async function saveProjectEdit() {
    if (!editingProject) return;
    setIsActionLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${editingProject.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editProjectTitle, status: editProjectStatus }),
      });
      if (res.ok) {
        setProjects((prev) => prev.map((p) => p.id === editingProject.id ? { ...p, title: editProjectTitle, status: editProjectStatus } : p));
        setEditingProject(null);
        showSuccess("Project updated successfully.");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update project");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-navy border-t-gold rounded-full animate-spin"></div>
          <p className="text-navy font-bold">Loading Control Center...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-navy mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/admin/login" className="bg-navy text-white px-6 py-2 rounded-lg font-semibold hover:bg-navy/90 transition">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  const sidebarLinks = [
    { id: "overview", label: "Dashboard", icon: "📊" },
    { id: "verifications", label: overview?.pendingVerifications ? `Verifications (${overview.pendingVerifications})` : "Verifications", icon: "🪪" },
    { id: "clients", label: "Clients", icon: "🏢" },
    { id: "talents", label: "Talent", icon: "🎓" },
    { id: "projects", label: "Projects", icon: "🚀" },
    { id: "payments", label: "Payments", icon: "💳" },
    { id: "messages", label: "Messages", icon: "✉️" },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50 font-sans">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-navy text-white hidden md:flex flex-col sticky top-0 h-screen shadow-xl">
        <div className="p-6 flex items-center gap-3 border-b border-white/10">
          <div className="h-10 w-10 rounded-lg bg-gold flex items-center justify-center text-navy font-extrabold text-lg">
            SA
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">CertiTask</h1>
            <p className="text-[10px] text-white/60 font-mono uppercase tracking-widest">Admin Center</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {sidebarLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === link.id
                  ? "bg-gold text-navy shadow-md"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
              {link.id === "messages" && overview && overview.unreadMessages > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">
                  {overview.unreadMessages}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile Header */}
        <header className="md:hidden bg-navy text-white p-4 flex items-center justify-between sticky top-0 z-10 shadow-md">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-gold text-navy flex items-center justify-center font-bold">SA</div>
            <span className="font-bold">Admin</span>
          </div>
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as Tab)}
            className="bg-white/10 border border-white/20 text-white text-sm rounded-lg px-3 py-1.5 focus:ring-gold"
          >
            {sidebarLinks.map(l => <option key={l.id} value={l.id} className="text-black">{l.label}</option>)}
          </select>
        </header>

        {/* Global Notifications */}
        {actionSuccess && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg font-semibold flex items-center gap-2 animate-fade-in">
            <span>✅</span> {actionSuccess}
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-navy capitalize flex items-center gap-2">
              {sidebarLinks.find(l => l.id === activeTab)?.icon} {sidebarLinks.find(l => l.id === activeTab)?.label}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Manage and monitor your platform&apos;s activity.</p>
          </div>

          {/* ── OVERVIEW ── */}
          {activeTab === "overview" && overview && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  { label: "Clients", value: overview.clients, color: "bg-blue-50 text-blue-700 border-blue-100" },
                  { label: "Talent", value: overview.talents, color: "bg-green-50 text-green-700 border-green-100" },
                  { label: "Pending verifications", value: overview.pendingVerifications, color: "bg-amber-50 text-amber-700 border-amber-100" },
                  { label: "Projects", value: overview.projects, color: "bg-purple-50 text-purple-700 border-purple-100" },
                  { label: "Applications", value: overview.applications, color: "bg-orange-50 text-orange-700 border-orange-100" },
                  { label: "New Submissions", value: overview.submissionsThisWeek, color: "bg-cyan-50 text-cyan-700 border-cyan-100" },
                  { label: "Certificates", value: overview.certificatesIssued, color: "bg-yellow-50 text-yellow-700 border-yellow-100" },
                ].map((stat) => (
                  <div key={stat.label} className={`p-6 rounded-2xl border shadow-sm ${stat.color} flex flex-col justify-between`}>
                    <span className="text-xs font-bold uppercase tracking-wider opacity-80 mb-2">{stat.label}</span>
                    <span className="text-4xl font-extrabold">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {activeTab === "clients" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Type / Status</th>
                      <th className="px-6 py-4">Projects</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clients.map((c) => (
                      <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-navy flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-navy text-gold flex items-center justify-center font-bold text-xs">
                            {c.name.charAt(0)}
                          </div>
                          {c.name}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{c.email}</td>
                        <td className="px-6 py-4"><UserStatus clientType={c.clientType} verificationStatus={c.verificationStatus} suspendedAt={c.suspendedAt} /></td>
                        <td className="px-6 py-4"><span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-md font-medium text-xs">{c._count.projectsPosted} · {c._count.certificatesIssued} certs</span></td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(c.createdAt)}</td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            disabled={isActionLoading}
                            onClick={() => { setEditingUser(c); setEditUserName(c.name); setEditUserSuspended(!!c.suspendedAt); }}
                            className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            disabled={isActionLoading}
                            onClick={() => deleteUser(c.id, "client")}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No clients yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── TALENT ── */}
          {activeTab === "talents" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                    <tr>
                      <th className="px-6 py-4">Name</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Teams / Certs</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {talents.map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 font-medium text-navy flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-xs">
                            {s.name.charAt(0)}
                          </div>
                          {s.name}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{s.email}</td>
                        <td className="px-6 py-4"><UserStatus clientType={null} verificationStatus={s.verificationStatus} suspendedAt={s.suspendedAt} /></td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-bold">{s._count.teamMemberships}</span>
                            <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-xs font-bold">{s._count.certificatesEarned}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            disabled={isActionLoading}
                            onClick={() => { setEditingUser(s); setEditUserName(s.name); setEditUserSuspended(!!s.suspendedAt); }}
                            className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            disabled={isActionLoading}
                            onClick={() => deleteUser(s.id, "talent")}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {talents.length === 0 && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No talent accounts yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PROJECTS ── */}
          {activeTab === "projects" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-semibold border-b">
                    <tr>
                      <th className="px-6 py-4">Project Title</th>
                      <th className="px-6 py-4">Client</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {projects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-navy truncate max-w-xs">{p.title}</p>
                          <p className="text-xs text-gray-400 mt-1">Apps: {p._count.applications} | Subs: {p._count.submissions}</p>
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          <p className="font-medium">{p.client.name}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                            p.status === "PAUSED" || p.status === "PENDING_PAYMENT" ? "bg-yellow-100 text-yellow-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            disabled={isActionLoading}
                            onClick={() => { setEditingProject(p); setEditProjectTitle(p.title); setEditProjectStatus(p.status); }}
                            className="text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            disabled={isActionLoading}
                            onClick={() => deleteProject(p.id)}
                            className="text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {projects.length === 0 && (
                      <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No projects found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── PAYMENTS ── */}
          {activeTab === "payments" && <PaymentsPanel />}

          {/* ── VERIFICATIONS ── */}
          {activeTab === "verifications" && <VerificationQueue onDecided={() => { void fetchAll(); }} />}

          {/* ── MESSAGES ── */}
          {activeTab === "messages" && (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="bg-white p-12 text-center text-gray-500 rounded-xl border">No messages received.</div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className={`bg-white p-6 rounded-xl border shadow-sm ${!m.isRead ? 'border-l-4 border-l-gold' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-navy">{m.priority && <span className="mr-2 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 align-middle">PRO · PRIORITY</span>}{m.subject || "No Subject"}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{m.name} ({m.email})</p>
                      </div>
                      <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{formatDate(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg mt-3">{m.message}</p>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </main>

      {/* ── MODALS ── */}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy">Edit User</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="suspendUser"
                  checked={editUserSuspended}
                  onChange={(e) => setEditUserSuspended(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <label htmlFor="suspendUser" className="text-sm font-medium text-gray-700">Suspend this account (blocks sign-in immediately)</label>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <button onClick={() => setEditingUser(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button disabled={isActionLoading} onClick={saveUserEdit} className="px-6 py-2 bg-navy text-white font-bold rounded-lg hover:bg-navy/90 transition disabled:opacity-50">
                {isActionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-navy">Edit Project</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Project Title</label>
                <input
                  type="text"
                  value={editProjectTitle}
                  onChange={(e) => setEditProjectTitle(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy focus:border-navy outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={editProjectStatus}
                  onChange={(e) => setEditProjectStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-navy outline-none"
                >
                  {PROJECT_STATUSES.map(st => <option key={st} value={st}>{PROJECT_STATUS_LABEL[st]}</option>)}
                </select>
              </div>
            </div>
            <div className="p-4 bg-gray-50 border-t flex justify-end gap-2">
              <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition">Cancel</button>
              <button disabled={isActionLoading} onClick={saveProjectEdit} className="px-6 py-2 bg-navy text-white font-bold rounded-lg hover:bg-navy/90 transition disabled:opacity-50">
                {isActionLoading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
