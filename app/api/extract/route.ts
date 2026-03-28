import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type SourceDocument = {
  id: string;
  source_id: string;
  url: string;
  title: string | null;
  raw_text: string;
  raw_json: any;
  document_type: string;
  status: "new" | "processed" | "failed";
};

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function truncate(text: string, max = 240) {
  const clean = normalizeWhitespace(text);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trim() + "…";
}

function detectIssueTitle(doc: SourceDocument): string {
  const raw = `${doc.title ?? ""} ${doc.raw_text}`.toLowerCase();

  const rules: Array<{ keywords: string[]; title: string }> = [
    { keywords: ["water pump", "coolant leak", "overheating"], title: "Water pump failure or coolant leak" },
    { keywords: ["timing chain", "chain rattle", "timing tensioner"], title: "Timing chain or tensioner issue" },
    { keywords: ["brake", "braking", "caliper"], title: "Brake system issue" },
    { keywords: ["transmission", "shifting", "gear slipping"], title: "Transmission issue" },
    { keywords: ["engine stall", "stalling"], title: "Engine stalling issue" },
    { keywords: ["alternator", "charging system", "battery light"], title: "Charging system / alternator issue" },
    { keywords: ["suspension", "control arm", "bushing", "strut"], title: "Suspension wear issue" },
    { keywords: ["wheel bearing", "humming noise"], title: "Wheel bearing issue" },
    { keywords: ["oil leak", "valve cover", "gasket"], title: "Oil leak / gasket issue" },
    { keywords: ["ac compressor", "air conditioning"], title: "A/C system issue" },
    { keywords: ["fuel pump", "fuel delivery"], title: "Fuel system / fuel pump issue" },
    { keywords: ["steering", "power steering"], title: "Steering system issue" },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((k) => raw.includes(k))) return rule.title;
  }

  if (doc.title && doc.title.trim().length > 0) {
    return truncate(doc.title, 90);
  }

  return "Potential vehicle reliability issue";
}

function detectJobTitle(issueTitle: string): string {
  const lower = issueTitle.toLowerCase();

  if (lower.includes("water pump")) return "Replace water pump";
  if (lower.includes("timing chain")) return "Inspect and replace timing chain components";
  if (lower.includes("brake")) return "Inspect and repair brake system";
  if (lower.includes("transmission")) return "Diagnose and repair transmission issue";
  if (lower.includes("alternator") || lower.includes("charging")) return "Replace alternator or charging components";
  if (lower.includes("suspension")) return "Inspect and replace worn suspension components";
  if (lower.includes("wheel bearing")) return "Replace wheel bearing";
  if (lower.includes("oil leak") || lower.includes("gasket")) return "Replace leaking gasket or seal";
  if (lower.includes("fuel")) return "Inspect and replace fuel system components";
  if (lower.includes("steering")) return "Inspect and repair steering components";

  return "Inspect and repair affected component";
}

function detectDifficulty(jobTitle: string): "novice" | "intermediate" | "expert" {
  const lower = jobTitle.toLowerCase();

  if (lower.includes("wheel bearing") || lower.includes("timing chain") || lower.includes("transmission")) {
    return "expert";
  }

  if (
    lower.includes("water pump") ||
    lower.includes("alternator") ||
    lower.includes("suspension") ||
    lower.includes("brake")
  ) {
    return "intermediate";
  }

  return "novice";
}

function buildIssueSummary(doc: SourceDocument): string {
  const raw = normalizeWhitespace(doc.raw_text);

  if (doc.document_type === "nhtsa_recall") {
    return truncate(
      `This source suggests a recurring reliability or safety concern. ${raw}`,
      260
    );
  }

  if (doc.document_type === "dealer_page") {
    return truncate(
      `This dealer or service page appears to describe a known issue, symptom, or repair concern. ${raw}`,
      260
    );
  }

  if (doc.document_type === "reddit_post" || doc.document_type === "reddit_comment") {
    return truncate(
      `Owners are discussing a possible recurring issue, including symptoms and repair experiences. ${raw}`,
      260
    );
  }

  return truncate(raw, 260);
}

function buildJobSummary(issueTitle: string, doc: SourceDocument): string {
  const base = normalizeWhitespace(doc.raw_text);

  if (issueTitle.toLowerCase().includes("water pump")) {
    return "Inspect for coolant leaks or overheating symptoms, then replace the water pump and gasket, refill coolant, and bleed the cooling system.";
  }

  if (issueTitle.toLowerCase().includes("timing chain")) {
    return "Inspect for timing chain noise, tensioner wear, or startup rattle. Replace worn timing components before they cause more serious engine damage.";
  }

  if (issueTitle.toLowerCase().includes("brake")) {
    return "Inspect the brake system, identify the worn or failing component, and replace pads, rotors, calipers, or hardware as needed.";
  }

  return truncate(
    `Inspect the affected system, confirm the failure point, and repair or replace the worn component. Source notes: ${base}`,
    260
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = Number(body.limit ?? 10);

    const { data: docs, error: docsError } = await supabaseAdmin
      .from("source_documents")
      .select("id,source_id,url,title,raw_text,raw_json,document_type,status")
      .eq("status", "new")
      .order("created_at", { ascending: true })
      .limit(limit);

    if (docsError) {
      return NextResponse.json({ error: docsError.message }, { status: 500 });
    }

    const documents = (docs ?? []) as SourceDocument[];

    let processed = 0;
    let issueCandidatesCreated = 0;
    let jobCandidatesCreated = 0;

    const issueErrors: string[] = [];
    const jobErrors: string[] = [];

    for (const doc of documents) {
      const issueTitle = detectIssueTitle(doc);
      const issueSummary = buildIssueSummary(doc);
      const jobTitle = detectJobTitle(issueTitle);
      const jobSummary = buildJobSummary(issueTitle, doc);
      const difficulty = detectDifficulty(jobTitle);

      const issueInsert = await supabaseAdmin.from("issue_candidates").insert({
        source_document_id: doc.id,
        title: issueTitle,
        summary: issueSummary,
        confidence: doc.document_type === "nhtsa_recall" ? 0.85 : 0.65,
        source_urls: [doc.url],
        status: "pending",
      });

      if (issueInsert.error) {
        issueErrors.push(issueInsert.error.message);
      } else {
        issueCandidatesCreated += 1;
      }

      const jobInsert = await supabaseAdmin.from("job_candidates").insert({
        source_document_id: doc.id,
        title: jobTitle,
        summary: jobSummary,
        difficulty,
        confidence: doc.document_type === "nhtsa_recall" ? 0.75 : 0.6,
        source_urls: [doc.url],
        status: "pending",
      });

      if (jobInsert.error) {
        jobErrors.push(jobInsert.error.message);
      } else {
        jobCandidatesCreated += 1;
      }

      await supabaseAdmin
        .from("source_documents")
        .update({ status: "processed" })
        .eq("id", doc.id);

      processed += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      issueCandidatesCreated,
      jobCandidatesCreated,
      issueErrors,
      jobErrors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
