import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SourceDocument = {
  id: string;
  raw_json: {
    components?: string;
    summary?: string;
    crash?: boolean;
    fire?: boolean;
  };
};

type ComponentGroup = {
  count: number;
  summaries: string[];
  hasCrash: boolean;
  hasFire: boolean;
};

function normalizeComponent(raw: string): string {
  const u = raw.toUpperCase();
  if (u.includes("ENGINE"))                              return "Engine";
  if (u.includes("FUEL"))                                return "Fuel System";
  if (u.includes("TRANSMISSION"))                        return "Transmission";
  if (u.includes("BRAKE"))                               return "Brakes";
  if (u.includes("ELECTRICAL") || u.includes("WIRING")) return "Electrical System";
  if (u.includes("STEERING"))                            return "Steering";
  if (u.includes("SUSPENSION"))                          return "Suspension";
  if (u.includes("COOLING"))                             return "Cooling System";
  if (u.includes("EXHAUST"))                             return "Exhaust";
  if (u.includes("AIR BAG") || u.includes("AIRBAG"))    return "Airbags";
  if (u.includes("SEAT BELT"))                           return "Seat Belts";
  if (u.includes("TIRE") || u.includes("WHEEL"))        return "Tires & Wheels";
  return toTitleCase(raw);
}

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const COMPONENT_DISPLAY: Record<string, string> = {
  "Engine":           "Engine Failure",
  "Fuel System":      "Fuel System Issue",
  "Transmission":     "Transmission Failure",
  "Brakes":           "Brake System Issue",
  "Electrical System":"Electrical System Failure",
  "Steering":         "Steering System Issue",
  "Suspension":       "Suspension Failure",
  "Cooling System":   "Cooling System Failure",
  "Exhaust":          "Exhaust System Issue",
  "Airbags":          "Airbag System Issue",
  "Seat Belts":       "Seat Belt Issue",
  "Tires & Wheels":   "Tires & Wheels Issue",
};

function toDisplayTitle(component: string): string {
  return COMPONENT_DISPLAY[component] ?? component;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const vehicleGenerationId = String(body.vehicleGenerationId ?? "").trim();

    if (!vehicleGenerationId) {
      return NextResponse.json({ error: "vehicleGenerationId is required" }, { status: 400 });
    }

    // Step 1 — Fetch source documents
    const { data: docs, error: docsError } = await supabaseAdmin
      .from("source_documents")
      .select("id, raw_json")
      .eq("vehicle_generation_id", vehicleGenerationId)
      .eq("document_type", "nhtsa_complaint");

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    const documents = (docs ?? []) as SourceDocument[];

    if (documents.length === 0) {
      return NextResponse.json({
        ok: true,
        documentsProcessed: 0,
        uniqueComponents: 0,
        issuesCreated: 0,
        jobsCreated: 0,
        skipped: 0,
      });
    }

    // Step 2 — Group and count by normalized component
    const grouped = new Map<string, ComponentGroup>();

    for (const doc of documents) {
      const raw = doc.raw_json?.components?.trim();
      if (!raw) continue;

      const component = normalizeComponent(raw);
      const existing = grouped.get(component) ?? {
        count: 0,
        summaries: [],
        hasCrash: false,
        hasFire: false,
      };

      existing.count += 1;
      if (doc.raw_json?.summary) existing.summaries.push(doc.raw_json.summary.trim());
      if (doc.raw_json?.crash) existing.hasCrash = true;
      if (doc.raw_json?.fire) existing.hasFire = true;

      grouped.set(component, existing);
    }

    const top25 = Array.from(grouped.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25);

    const maxCount = top25[0]?.[1].count ?? 1;

    // Pre-check which components already have issues so we can count skips accurately
    const componentNames = top25.map(([c]) => c);

    const { data: existingIssueRows } = await supabaseAdmin
      .from("issues")
      .select("id, component")
      .in("component", componentNames)
      .eq("source", "nhtsa_complaints");

    const existingByComponent = new Map<string, string>(
      (existingIssueRows ?? []).map((r: { id: string; component: string }) => [r.component, r.id])
    );

    let issuesCreated = 0;
    let jobsCreated = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Step 3 — Write issues, vehicle_issues, jobs, issue_jobs
    for (let rank = 0; rank < top25.length; rank++) {
      const [component, group] = top25[rank];
      const isNew = !existingByComponent.has(component);
      const issueTitle = toDisplayTitle(component);
      const summary = group.summaries.slice(0, 3).join(" | ") || issueTitle;
      const safetyLevel = group.hasCrash || group.hasFire ? 2 : 1;
      const severityScore = safetyLevel === 2 ? 0.8 : 0.4;
      const frequencyScore = group.count / maxCount;

      // a) Upsert issue
      const { data: issueRow, error: issueError } = await supabaseAdmin
        .from("issues")
        .upsert(
          {
            title: issueTitle,
            summary,
            component,
            system_tag: component,
            safety_level: safetyLevel,
            source: "nhtsa_complaints",
          },
          { onConflict: "component,source" }
        )
        .select("id")
        .single();

      if (issueError || !issueRow) {
        errors.push(`Issue upsert failed for "${component}": ${issueError?.message ?? "no row returned"}`);
        skipped += 1;
        continue;
      }

      const issueId: string = issueRow.id;

      if (isNew) {
        issuesCreated += 1;
      } else {
        skipped += 1;
      }

      // b) Upsert vehicle_issues
      const { error: viError } = await supabaseAdmin
        .from("vehicle_issues")
        .upsert(
          {
            vehicle_generation_id: vehicleGenerationId,
            issue_id: issueId,
            rank_score: group.count,
            frequency_score: frequencyScore,
            severity_score: severityScore,
            confidence: 0.7,
            cost_diy_parts_low: 0,
            cost_diy_parts_high: 0,
            cost_shop_low: 0,
            cost_shop_high: 0,
          },
          { onConflict: "vehicle_generation_id,issue_id" }
        );

      if (viError) {
        errors.push(`vehicle_issues upsert failed for "${component}": ${viError.message}`);
      }

      // c & d) Only create job + issue_jobs row if the issue is new
      if (!isNew) continue;

      const { data: jobRow, error: jobError } = await supabaseAdmin
        .from("jobs")
        .insert({
          title: `Fix: ${issueTitle}`,
          difficulty: "professional",
          layman_steps: "Steps will be added soon.",
          tool_list: null,
          disclaimer: "Always consult a qualified mechanic before attempting repairs.",
          time_minutes_low: null,
          time_minutes_high: null,
        })
        .select("id")
        .single();

      if (jobError || !jobRow) {
        errors.push(`Job insert failed for "${component}": ${jobError?.message ?? "no row returned"}`);
        continue;
      }

      jobsCreated += 1;

      const { error: ijError } = await supabaseAdmin
        .from("issue_jobs")
        .upsert(
          {
            issue_id: issueId,
            job_id: jobRow.id,
            recommended_order: rank + 1,
          },
          { onConflict: "issue_id,job_id" }
        );

      if (ijError) {
        errors.push(`issue_jobs upsert failed for "${component}": ${ijError.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      documentsProcessed: documents.length,
      uniqueComponents: grouped.size,
      issuesCreated,
      jobsCreated,
      skipped,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
