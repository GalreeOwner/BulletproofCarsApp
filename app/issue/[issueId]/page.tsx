"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Issue = { id: string; title: string; summary: string; safety_level: number };
type JobRow = {
  recommended_order: number;
  jobs: {
    id: string;
    title: string;
    difficulty: "novice" | "intermediate" | "expert";
    time_minutes_low: number | null;
    time_minutes_high: number | null;
    disclaimer: string | null;
  } | null;
};

export default function IssuePage() {
  const params = useParams();
  const sp = useSearchParams();
  const genId = sp.get("gen");
  const issueId = String(params.issueId);

  const [issue, setIssue] = useState<Issue | null>(null);
  const [jobs, setJobs] = useState<JobRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("issues").select("id,title,summary,safety_level").eq("id", issueId).single();
      if (data) setIssue(data as any);

      const { data: jobData } = await supabase
        .from("issue_jobs")
        .select(`
          recommended_order,
          jobs:job_id (id, title, difficulty, time_minutes_low, time_minutes_high, disclaimer)
        `)
        .eq("issue_id", issueId)
        .order("recommended_order", { ascending: true });

      if (jobData) setJobs(jobData as any);
    })();
  }, [issueId]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link className="underline text-sm" href={genId ? `/vehicle/results?gen=${genId}` : "/vehicle"}>
        ← Back to results
      </Link>

      <h1 className="text-2xl font-bold mt-4">{issue?.title ?? "Issue"}</h1>
      <p className="mt-2 text-gray-700">{issue?.summary}</p>

      <h2 className="text-xl font-semibold mt-6">Recommended jobs (easy → hard)</h2>

      <div className="mt-4 space-y-3">
        {jobs.map((j, idx) => (
          <div key={idx} className="border rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold">{j.jobs?.title}</div>
              <span className="text-sm text-gray-600">{j.jobs?.difficulty}</span>
            </div>

            {(j.jobs?.time_minutes_low || j.jobs?.time_minutes_high) && (
              <p className="text-sm text-gray-600 mt-2">
                Time: {j.jobs?.time_minutes_low ?? "?"}–{j.jobs?.time_minutes_high ?? "?"} minutes
              </p>
            )}

            {j.jobs?.difficulty === "expert" && (
              <p className="text-sm text-orange-700 mt-2">
                Expert-level: consider a professional mechanic if you’re not confident.
              </p>
            )}

            <div className="mt-3">
              <Link className="underline" href={`/job/${j.jobs?.id}?gen=${genId ?? ""}`}>
                View parts & videos →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
