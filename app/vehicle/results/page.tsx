"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Row = {
  id: string;
  rank_score: number;
  confidence: number;
  mileage_start: number | null;
  mileage_end: number | null;
  issues: { id: string; title: string; summary: string; safety_level: number } | null;
};

export default function VehicleResultsPage() {
  const sp = useSearchParams();
  const genId = sp.get("gen");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!genId) return;

    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("vehicle_issues")
        .select(`
          id, rank_score, confidence, mileage_start, mileage_end,
          issues:issue_id (id, title, summary, safety_level)
        `)
        .eq("vehicle_generation_id", genId)
        .order("rank_score", { ascending: false })
        .limit(10);

      if (!error && data) setRows(data as any);
      setLoading(false);
    })();
  }, [genId]);

  if (!genId) {
    return (
      <main className="p-6 max-w-2xl mx-auto">
        <p className="text-red-600">Missing generation id. Go back and select a vehicle.</p>
        <Link className="underline" href="/vehicle">Back</Link>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">Top failure points</h1>
      <p className="mt-2 text-gray-600">
        Ranked by frequency × severity × urgency (then adjusted by confidence).
      </p>

      {loading ? (
        <p className="mt-6">Loading…</p>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((r, idx) => (
            <div key={r.id} className="border rounded-xl p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">
                  {idx + 1}. {r.issues?.title ?? "Unknown issue"}
                </h2>
                <span className="text-sm text-gray-500">
                  Confidence: {Math.round((r.confidence ?? 0.5) * 100)}%
                </span>
              </div>

              <p className="mt-2 text-gray-700">{r.issues?.summary}</p>

              {(r.mileage_start || r.mileage_end) && (
                <p className="mt-2 text-sm text-gray-600">
                  Typical window: {r.mileage_start ?? "?"}–{r.mileage_end ?? "?"} miles
                </p>
              )}

              <div className="mt-3">
                <Link
                  className="underline"
                  href={`/issue/${r.issues?.id}?gen=${genId}`}
                >
                  View jobs & recommended parts →
                </Link>
              </div>
            </div>
          ))}

          <p className="text-sm text-gray-500 mt-4">
            Later we’ll add “Show more than 10” with paging.
          </p>
        </div>
      )}
    </main>
  );
}
