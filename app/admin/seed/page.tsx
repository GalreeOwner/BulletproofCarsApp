"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminSeedPage() {
  const router = useRouter();
  const [title, setTitle] = useState("Water pump leak");
  const [summary, setSummary] = useState("Common leak from water pump gasket/seal. Replace water pump before overheating.");
  const [jobTitle, setJobTitle] = useState("Replace water pump");
  const [jobSummary, setJobSummary] = useState("Drain coolant, remove belt, remove pump bolts, install new pump + gasket, refill and bleed.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) router.push("/login");
    })();
  }, [router]);

  async function seedIssueCandidate() {
    setBusy(true);
    const { error } = await supabase.from("issue_candidates").insert({
      title,
      summary,
      confidence: 0.7,
      source_urls: ["https://example.com/dealer-faq-placeholder"],
    });
    setBusy(false);
    if (error) return alert(error.message);
    alert("Seeded issue candidate!");
  }

  async function seedJobCandidate() {
    setBusy(true);
    const { error } = await supabase.from("job_candidates").insert({
      title: jobTitle,
      summary: jobSummary,
      difficulty: "intermediate",
      confidence: 0.7,
      source_urls: ["https://example.com/reddit-placeholder"],
    });
    setBusy(false);
    if (error) return alert(error.message);
    alert("Seeded job candidate!");
  }

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Admin • Seed</h1>
      <p className="mt-2 text-gray-600">
        Quick seed tools (Phase 2). Inserts candidates you can approve in /admin/candidates.
      </p>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Seed Issue Candidate</h2>
        <input className="w-full border rounded-lg p-2 mt-3" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea className="w-full border rounded-lg p-2 mt-3" rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
        <button disabled={busy} onClick={seedIssueCandidate} className="mt-3 rounded-lg bg-black text-white px-4 py-2">
          Seed issue candidate
        </button>
      </div>

      <div className="mt-6 border rounded-xl p-4">
        <h2 className="font-semibold">Seed Job Candidate</h2>
        <input className="w-full border rounded-lg p-2 mt-3" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        <textarea className="w-full border rounded-lg p-2 mt-3" rows={3} value={jobSummary} onChange={(e) => setJobSummary(e.target.value)} />
        <button disabled={busy} onClick={seedJobCandidate} className="mt-3 rounded-lg bg-black text-white px-4 py-2">
          Seed job candidate
        </button>
      </div>
    </main>
  );
}