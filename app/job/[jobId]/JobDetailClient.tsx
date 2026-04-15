"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  layman_steps: string;
  difficulty: "novice" | "intermediate" | "expert";
  tool_list: string | null;
  disclaimer: string | null;
};

type Part = {
  id: string;
  name: string;
  brand: string | null;
  quality_tier: string | null;
};

type PartRow = {
  recommended_rank: number;
  parts: Part | null;
};

type Vendor = {
  name: string;
};

type OfferRow = {
  price: number | null;
  affiliate_url: string;
  vendors: Vendor | null;
};

type HowtoResource = {
  title: string;
  url: string;
  publisher: string | null;
};

type VideoRow = {
  rank: number;
  howto_resources: HowtoResource | null;
};

type RawPartRow = {
  recommended_rank: number;
  parts: Part | Part[] | null;
};

type RawOfferRow = {
  price: number | null;
  affiliate_url: string;
  vendors: Vendor | Vendor[] | null;
};

type RawVideoRow = {
  rank: number;
  howto_resources: HowtoResource | HowtoResource[] | null;
};

type Props = {
  jobId: string;
};

export default function JobDetailClient({ jobId }: Props) {
  const genId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const sp = new URLSearchParams(window.location.search);
    return sp.get("gen");
  }, []);

  const [job, setJob] = useState<Job | null>(null);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [offersByPartId, setOffersByPartId] = useState<Record<string, OfferRow[]>>({});
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id,title,layman_steps,difficulty,tool_list,disclaimer")
        .eq("id", jobId)
        .single();

      if (jobError || !jobData) {
        setError(jobError?.message ?? "Job not found");
        setLoading(false);
        return;
      }

      setJob(jobData as Job);

      const { data: partRows, error: partError } = await supabase
        .from("job_parts")
        .select("recommended_rank, parts:part_id (id,name,brand,quality_tier)")
        .eq("job_id", jobId)
        .order("recommended_rank", { ascending: true });

      if (partError) {
        setError(partError.message);
        setLoading(false);
        return;
      }

      if (partRows) {
        const normalizedPartRows: PartRow[] = (partRows as RawPartRow[]).map((row) => ({
          recommended_rank: row.recommended_rank,
          parts: Array.isArray(row.parts) ? row.parts[0] ?? null : row.parts,
        }));

        setParts(normalizedPartRows);

        const offersMap: Record<string, OfferRow[]> = {};

        for (const pr of normalizedPartRows) {
          const partId = pr.parts?.id;
          if (!partId) continue;

          const { data: offers } = await supabase
            .from("vendor_offers")
            .select("price, affiliate_url, vendors:vendor_id (name)")
            .eq("part_id", partId);

          const normalizedOffers: OfferRow[] = ((offers ?? []) as RawOfferRow[]).map((offer) => ({
            price: offer.price,
            affiliate_url: offer.affiliate_url,
            vendors: Array.isArray(offer.vendors) ? offer.vendors[0] ?? null : offer.vendors,
          }));

          offersMap[partId] = normalizedOffers;
        }

        setOffersByPartId(offersMap);
      }

      const { data: videoRows, error: videoError } = await supabase
        .from("job_resources")
        .select("rank, howto_resources:howto_resource_id (title,url,publisher)")
        .eq("job_id", jobId)
        .order("rank", { ascending: true });

      if (videoError) {
        setError(videoError.message);
        setLoading(false);
        return;
      }

      if (videoRows) {
        const normalizedVideoRows: VideoRow[] = (videoRows as RawVideoRow[]).map((row) => ({
          rank: row.rank,
          howto_resources: Array.isArray(row.howto_resources)
            ? row.howto_resources[0] ?? null
            : row.howto_resources,
        }));

        setVideos(normalizedVideoRows);
      }

      setLoading(false);
    })();
  }, [jobId]);

  if (loading) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <p>Loading job details…</p>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="p-6 max-w-3xl mx-auto">
        <p className="text-red-600">{error ?? "Job not found."}</p>
        <div className="mt-4">
          <Link className="underline" href={genId ? `/vehicle/results?gen=${genId}` : "/vehicle"}>
            ← Back
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link className="underline text-sm" href={genId ? `/vehicle/results?gen=${genId}` : "/vehicle"}>
        ← Back
      </Link>

      <h1 className="text-2xl font-bold mt-4">{job.title}</h1>

      <p className="mt-2 text-gray-700 whitespace-pre-wrap">{job.layman_steps}</p>

      {job.tool_list && (
        <p className="mt-3 text-sm text-gray-600">
          Tools: {job.tool_list}
        </p>
      )}

      {job.difficulty === "expert" && (
        <p className="mt-3 text-sm text-orange-700">
          Expert-level job. If you’re not confident, consider using a professional mechanic.
        </p>
      )}

      {job.disclaimer && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {job.disclaimer}
        </div>
      )}

      <h2 className="text-xl font-semibold mt-6">Recommended parts</h2>
      <div className="mt-4 space-y-3">
        {parts.length > 0 ? (
          parts.map((p, idx) => {
            const partId = p.parts?.id ?? "";
            const offers = offersByPartId[partId] ?? [];

            return (
              <div key={idx} className="border rounded-xl p-4">
                <div className="font-semibold">
                  {p.parts?.name} {p.parts?.brand ? `(${p.parts.brand})` : ""}
                </div>

                <div className="text-sm text-gray-600">
                  Tier: {p.parts?.quality_tier ?? "unknown"}
                </div>

                {offers.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {offers.map((o, i) => (
                      <a
                        key={i}
                        href={o.affiliate_url}
                        target="_blank"
                        rel="noreferrer"
                        className="block underline"
                      >
                        Buy at {o.vendors?.name ?? "Vendor"} {o.price ? `— $${o.price}` : ""}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-gray-500">No vendor links yet.</p>
                )}
              </div>
            );
          })
        ) : (
          <div className="border rounded-xl p-4 text-sm text-gray-500">
            No recommended parts yet.
          </div>
        )}
      </div>

      <h2 className="text-xl font-semibold mt-8">How-to videos / guides</h2>
      <div className="mt-4 space-y-2">
        {videos.length > 0 ? (
          videos.map((v, idx) => (
            <a
              key={idx}
              href={v.howto_resources?.url ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="block underline"
            >
              {v.howto_resources?.title}
              {v.howto_resources?.publisher ? ` — ${v.howto_resources.publisher}` : ""}
            </a>
          ))
        ) : (
          <p className="text-sm text-gray-500">No resources yet.</p>
        )}
      </div>
    </main>
  );
}
