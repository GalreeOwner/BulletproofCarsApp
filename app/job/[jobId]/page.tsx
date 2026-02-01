"use client";

import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Job = {
  id: string;
  title: string;
  layman_steps: string;
  difficulty: "novice" | "intermediate" | "expert";
  tool_list: string | null;
  disclaimer: string | null;
};

type PartRow = {
  recommended_rank: number;
  parts: { id: string; name: string; brand: string | null; quality_tier: string | null } | null;
};

type OfferRow = {
  price: number | null;
  affiliate_url: string;
  vendors: { name: string } | null;
};

type VideoRow = {
  rank: number;
  howto_resources: { title: string; url: string; publisher: string | null } | null;
};

export default function JobPage() {
  const params = useParams();
  const sp = useSearchParams();
  const genId = sp.get("gen");
  const jobId = String(params.jobId);

  const [job, setJob] = useState<Job | null>(null);
  const [parts, setParts] = useState<PartRow[]>([]);
  const [offersByPartId, setOffersByPartId] = useState<Record<string, OfferRow[]>>({});
  const [videos, setVideos] = useState<VideoRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data: jobData } = await supabase
        .from("jobs")
        .select("id,title,layman_steps,difficulty,tool_list,disclaimer")
        .eq("id", jobId)
        .single();
      if (jobData) setJob(jobData as any);

      const { data: partRows } = await supabase
        .from("job_parts")
        .select("recommended_rank, parts:part_id (id,name,brand,quality_tier)")
        .eq("job_id", jobId)
        .order("recommended_rank", { ascending: true });

      if (partRows) {
        setParts(partRows as any);

        // Load offers for each part (simple approach for MVP)
        const offersMap: Record<string, OfferRow[]> = {};
        for (const pr of partRows as any[]) {
          const partId = pr.parts?.id;
          if (!partId) continue;

          const { data: offers } = await supabase
            .from("vendor_offers")
            .select("price, affiliate_url, vendors:vendor_id (name)")
            .eq("part_id", partId);

          offersMap[partId] = (offers ?? []) as any;
        }
        setOffersByPartId(offersMap);
      }

      const { data: videoRows } = await supabase
        .from("job_resources")
        .select("rank, howto_resources:howto_resource_id (title,url,publisher)")
        .eq("job_id", jobId)
        .order("rank", { ascending: true });

      if (videoRows) setVideos(videoRows as any);
    })();
  }, [jobId]);

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <Link className="underline text-sm" href={genId ? `/vehicle/results?gen=${genId}` : "/vehicle"}>
        ← Back
      </Link>

      <h1 className="text-2xl font-bold mt-4">{job?.title ?? "Job"}</h1>

      <p className="mt-2 text-gray-700">{job?.layman_steps}</p>

      {job?.tool_list && (
        <p className="mt-3 text-sm text-gray-600">
          Tools: {job.tool_list}
        </p>
      )}

      {job?.difficulty === "expert" && (
        <p className="mt-3 text-sm text-orange-700">
          Expert-level job. If you’re not confident, consider using a professional mechanic.
        </p>
      )}

      <h2 className="text-xl font-semibold mt-6">Recommended parts</h2>
      <div className="mt-4 space-y-3">
        {parts.map((p, idx) => {
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
        })}
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
