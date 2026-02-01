"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Make = { id: string; name: string };
type Model = { id: string; name: string; make_id: string };
type Gen = { id: string; name: string; model_id: string; year_start: number; year_end: number };

export default function VehiclePage() {
  const router = useRouter();

  const [makes, setMakes] = useState<Make[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [gens, setGens] = useState<Gen[]>([]);

  const [makeId, setMakeId] = useState("");
  const [modelId, setModelId] = useState("");
  const [year, setYear] = useState<number | "">("");

  // Load makes on first render
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("makes").select("id,name").order("name");
      if (!error && data) setMakes(data);
    })();
  }, []);

  // Load models when make changes
  useEffect(() => {
    if (!makeId) return;
    (async () => {
      setModelId("");
      setYear("");
      setGens([]);
      const { data, error } = await supabase
        .from("models")
        .select("id,name,make_id")
        .eq("make_id", makeId)
        .order("name");
      if (!error && data) setModels(data);
    })();
  }, [makeId]);

  // Load generations when model changes
  useEffect(() => {
    if (!modelId) return;
    (async () => {
      setYear("");
      const { data, error } = await supabase
        .from("vehicle_generations")
        .select("id,name,model_id,year_start,year_end")
        .eq("model_id", modelId)
        .order("year_start", { ascending: true });
      if (!error && data) setGens(data);
    })();
  }, [modelId]);

  const matchingGens = useMemo(() => {
    if (!year) return [];
    return gens.filter((g) => year >= g.year_start && year <= g.year_end);
  }, [gens, year]);

  const canContinue = makeId && modelId && year && matchingGens.length > 0;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">Choose your vehicle</h1>
      <p className="mt-2 text-gray-600">
        We use vehicle generations (not just year) because problems are usually platform-specific.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium">Make</label>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={makeId}
            onChange={(e) => setMakeId(e.target.value)}
          >
            <option value="">Select make...</option>
            {makes.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Model</label>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            disabled={!makeId}
          >
            <option value="">Select model...</option>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Year</label>
          <input
            className="mt-1 w-full border rounded-lg p-2"
            type="number"
            placeholder="e.g. 2016"
            value={year}
            onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")}
            disabled={!modelId}
          />
          {year && matchingGens.length === 0 && (
            <p className="text-sm text-red-600 mt-2">
              No generation found for that year. (You may need to seed generations in the database.)
            </p>
          )}
        </div>

        <button
          className="rounded-lg bg-black text-white px-5 py-3 disabled:opacity-50"
          disabled={!canContinue}
          onClick={() => {
            // If multiple gens match (rare), pick the first for now
            const gen = matchingGens[0];
            router.push(`/vehicle/results?gen=${gen.id}&year=${year}`);
          }}
        >
          See top issues
        </button>
      </div>
    </main>
  );
}
