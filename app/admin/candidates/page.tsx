"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type IssueCandidate = {
  id: string;
  title: string;
  summary: string;
  confidence: number;
  source_urls: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

type JobCandidate = {
  id: string;
  title: string;
  summary: string;
  difficulty: "novice" | "intermediate" | "expert";
  confidence: number;
  source_urls: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
};

export default function AdminCandidatesPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") as "issues" | "jobs") ?? "issues";

  const [tab, setTab] = useState<"issues" | "jobs">(initialTab);
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<IssueCandidate[]>([]);
  const [jobs, setJobs] = useState<JobCandidate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push("/login");
        return;
      }

      // admin check (RLS will protect too, but this avoids confusing UI)
      const { data: adminRow } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", sessionData.session.user.id)
        .maybeSingle();

      if (!adminRow) {
        router.push("/admin");
        return;
      }

      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function refresh() {
    setLoading(true);
    setError(null);

    const [issueRes, jobRes] = await Promise.all([
      supabase
        .from("issue_candidates")
        .select("id,title,summary,confidence,source_urls,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase
        .from("job_candidates")
        .select("id,title,summary,difficulty,confidence,source_urls,status,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);

    if (issueRes.error) setError(issueRes.error.message);
    if (jobRes.error) setError(jobRes.error.message);

    setIssues((issueRes.data as any) ?? []);
    setJobs((jobRes.data as any) ?? []);
    setLoading(false);
  }

  async function setStatus(table: "issue_candidates" | "job_candidates", id: string, status: "approved" | "rejected") {
    const { error } = await supabase.from(table).update({ status }).eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }
    await refresh();
  }

  const rows = useMemo(() => (tab === "issues" ? issues : jobs), [tab, issues, jobs]);

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Candidates</h1>

      <div className="mt-4 flex gap-3">
        <button
          className={`px-3 py-2 rounded-lg border ${tab === "issues" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("issues")}
        >
          Issues ({issues.length})
        </button>
        <button
          className={`px-3 py-2 rounded-lg border ${tab === "jobs" ? "bg-black text-white" : ""}`}
          onClick={() => setTab("jobs")}
        >
          Jobs ({jobs.length})
        </button>

        <button className="ml-auto underline" onClick={refresh}>
          Refresh
        </button>
      </div>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {loading ? (
        <p className="mt-6">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-gray-600">No pending candidates.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r: any) => (
            <div key={r.id} className="border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg">{r.title}</h2>
                  {tab === "jobs" && (
                    <p className="text-sm text-gray-600 mt-1">
                      Difficulty: <span className="font-medium">{r.difficulty}</span>
                    </p>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  Confidence: {Math.round((r.confidence ?? 0.5) * 100)}%
                </div>
              </div>

              <p className="mt-2 text-gray-700">{r.summary}</p>

              {Array.isArray(r.source_urls) && r.source_urls.length > 0 && (
                <div className="mt-3 text-sm">
                  <div className="text-gray-500">Sources:</div>
                  <ul className="list-disc pl-5">
                    {r.source_urls.slice(0, 3).map((u: string) => (
                      <li key={u}>
                        <a className="underline" href={u} target="_blank" rel="noreferrer">
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  className="rounded-lg bg-black text-white px-3 py-2"
                  onClick={() =>
                    setStatus(tab === "issues" ? "issue_candidates" : "job_candidates", r.id, "approved")
                  }
                >
                  Approve
                </button>
                <button
                  className="rounded-lg border px-3 py-2"
                  onClick={() =>
                    setStatus(tab === "issues" ? "issue_candidates" : "job_candidates", r.id, "rejected")
                  }
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}