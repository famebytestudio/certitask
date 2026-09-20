"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { CLIENT_TYPE_LABEL, PROJECT_CATEGORIES, PROJECT_CATEGORY_LABEL, type ProjectCategory } from "@/lib/enums";
import type { ProjectDto } from "@/lib/types";

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

export default function ProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState<"All" | ProjectCategory>("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [teamsOnly, setTeamsOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "deadline">("newest");
  const [showAll, setShowAll] = useState(false);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/projects");
        if (res.ok) {
          const data = await res.json();
          setProjects(data.projects as ProjectDto[]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    const list = projects.filter(p =>
      (category === "All" || p.category === category) &&
      (!verifiedOnly || p.client?.verificationStatus === "VERIFIED") &&
      (!teamsOnly || p.teamCap > 1) &&
      (!needle || p.title.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle) ||
        (p.client?.name ?? "").toLowerCase().includes(needle) || p.requiredSkills.some(s => s.toLowerCase().includes(needle)))
    );
    return sort === "deadline" ? [...list].sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()) : list;
  }, [projects, searchQuery, category, verifiedOnly, teamsOnly, sort]);
  const displayed = showAll ? filtered : filtered.slice(0, 6);

  return (
    <div className="flex flex-col min-h-screen">
      <section className="bg-gradient-to-b from-navy-dark to-navy text-paper py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#C9A227_1px,transparent_1px),linear-gradient(to_bottom,#C9A227_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-6">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider bg-gold/15 text-gold border border-gold/30">Open projects</span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Real work. <span className="text-gold">Real proof.</span></h1>
          <p className="text-paper/85 text-lg max-w-2xl mx-auto leading-relaxed">
            Short, well-scoped projects from organizations and individuals. Finish one, get it approved, and earn a certificate anyone can verify.
          </p>
        </div>
      </section>

      <section className="py-20 bg-paper text-ink flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="bg-white p-6 rounded-xl border border-navy/5 shadow-xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-navy/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input id="project-search" type="text" placeholder="Search by title, skill or client…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-paper border border-navy/15 rounded-lg text-ink font-sans focus:outline-hidden focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors text-sm" />
              </div>
              <Button variant="primary" onClick={() => { setSearchQuery(""); setCategory("All"); setVerifiedOnly(false); setTeamsOnly(false); setSort("newest"); setShowAll(false); }} className="w-full">Reset</Button>
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-navy/5 text-xs font-semibold text-navy">
              <label className="flex items-center gap-2 cursor-pointer"><input id="f-verified" type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} /> Verified clients only</label>
              <label className="flex items-center gap-2 cursor-pointer"><input id="f-teams" type="checkbox" checked={teamsOnly} onChange={e => setTeamsOnly(e.target.checked)} /> Team projects only</label>
              <label className="flex items-center gap-2">Sort
                <select id="f-sort" value={sort} onChange={e => setSort(e.target.value as "newest" | "deadline")} className="border border-navy/15 rounded px-2 py-1 bg-paper">
                  <option value="newest">Newest first</option><option value="deadline">Deadline soonest</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {(["All", ...PROJECT_CATEGORIES] as const).map((c) => (
                <button key={c} onClick={() => setCategory(c)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide border transition-all cursor-pointer ${category === c ? "bg-navy text-gold border-navy" : "bg-paper text-navy border-navy/10 hover:border-gold hover:text-gold"}`}>
                  {c === "All" ? "All" : PROJECT_CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center text-sm text-ink/70">
            <p>Showing <span className="font-bold text-navy">{filtered.length}</span> open project{filtered.length === 1 ? "" : "s"}</p>
          </div>

          {loading ? (
            <div className="text-center py-16"><p className="text-navy font-bold">Loading projects…</p></div>
          ) : filtered.length > 0 ? (
            <div className="space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {displayed.map((p) => {
                  const d = daysLeft(p.deadline);
                  return (
                    <div key={p.id} className="bg-white p-6 rounded-xl border border-navy/5 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] font-bold text-gold uppercase tracking-wider bg-gold/10 px-2 py-0.5 rounded border border-gold/10">{PROJECT_CATEGORY_LABEL[p.category]}</span>
                          {p.featured && <span className="ml-2 text-[10px] font-bold text-navy uppercase tracking-wider bg-gold px-2 py-0.5 rounded">★ Featured</span>}
                          <h3 className="font-sans font-bold text-xl text-navy mt-2 leading-snug"><Link href={`/projects/${p.id}`} className="hover:text-gold">{p.title}</Link></h3>
                          {p.client && (
                            <p className="text-xs font-semibold text-ink/60 mt-1">
                              <Link href={`/clients/${p.client.id}`} className="text-navy hover:underline">{p.client.name}</Link>
                              {p.client.clientType && <> · {CLIENT_TYPE_LABEL[p.client.clientType]}</>}
                              {p.client.verificationStatus === "VERIFIED" && <span className="ml-1 text-green-700">✓ Verified</span>}
                            </p>
                          )}
                        </div>
                        <p className="text-sm text-ink/80 leading-relaxed line-clamp-3">{p.description}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {p.requiredSkills.slice(0, 6).map((s) => <span key={s} className="px-2 py-0.5 rounded bg-paper text-navy text-[10px] font-semibold border border-navy/5">{s}</span>)}
                        </div>
                      </div>
                      <div className="space-y-4 pt-4 border-t border-navy/5 mt-6">
                        <div className="flex justify-between items-center text-xs text-ink/75">
                          <span className={d <= 3 ? "text-red-700 font-bold" : ""}>📅 {fmt(p.deadline)} · {d} day{d !== 1 ? "s" : ""} left</span>
                          <span className="font-semibold text-gold">{p.teamCap > 1 ? `Teams up to ${p.teamCap}` : "Individuals"}</span>
                        </div>
                        <Link href={`/projects/${p.id}`} className="w-full py-2.5 rounded-lg bg-navy text-paper text-xs font-bold hover:bg-navy-dark transition-all duration-300 cursor-pointer text-center border border-navy inline-block">
                          View &amp; apply
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!showAll && filtered.length > 6 && (
                <div className="text-center pt-4">
                  <button onClick={() => setShowAll(true)} className="inline-flex items-center justify-center px-10 py-3.5 rounded-lg bg-navy text-gold hover:bg-navy-dark text-sm font-bold transition-all duration-300 cursor-pointer border border-gold/15">
                    Show all ({filtered.length})
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 bg-white rounded-xl border border-navy/5">
              <h3 className="font-sans font-bold text-xl text-navy mb-2">No open projects{projects.length > 0 ? " match" : " right now"}</h3>
              <p className="text-sm text-ink/70">{projects.length > 0 ? "Try a different keyword or category." : "New projects are posted regularly — check back soon."}</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-20 bg-navy text-paper text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl font-extrabold text-paper tracking-tight">Have work that needs doing?</h2>
          <p className="text-paper/85 max-w-xl mx-auto">Post a project as an organization or an individual. Review the work, approve it, and the certificate is issued automatically.</p>
          <div className="pt-4"><Button href="/auth/signup" variant="gold">Post a project</Button></div>
        </div>
      </section>
    </div>
  );
}
