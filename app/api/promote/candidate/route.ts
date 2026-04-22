import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type IssueCandidateRow = {
  id: string;
  title: string;
  summary: string;
  confidence: number | null;
  vehicle_generation_id?: string | null;
};

type JobCandidateRow = {
  id: string;
  title: string;
  summary: string;
  difficulty: "novice" | "intermediate" | "expert";
  confidence: number | null;
  issue_id?: string | null;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type ?? "");
    const id = String(body.id ?? "");
    const issueId = body.issueId ? String(body.issueId) : null;

    if (!type || !id) {
      return NextResponse.json(
        { error: "type and id are required" },
        { status: 400 }
      );
    }

    if (type === "issue") {
      const { data: candidate, error: candidateError } = await supabaseAdmin
        .from("issue_candidates")
        .select("*")
        .eq("id", id)
        .single();

      const issueCandidate = candidate as IssueCandidateRow | null;

      if (candidateError || !issueCandidate) {
        return NextResponse.json(
          { error: candidateError?.message ?? "Issue candidate not found" },
          { status: 404 }
        );
      }

      const { data: insertedIssue, error: insertIssueError } = await supabaseAdmin
        .from("issues")
        .insert({
          title: issueCandidate.title,
          summary: issueCandidate.summary,
          system_tag: "general",
          safety_level: 0,
        })
        .select("id")
        .single();

      if (insertIssueError || !insertedIssue) {
        return NextResponse.json(
          { error: insertIssueError?.message ?? "Failed to create issue" },
          { status: 500 }
        );
      }

      let vehicleIssueLinked = false;
      let vehicleIssueLinkError: string | null = null;

      if (issueCandidate.vehicle_generation_id) {
        const { error: vehicleIssueError } = await supabaseAdmin
          .from("vehicle_issues")
          .insert({
            vehicle_generation_id: issueCandidate.vehicle_generation_id,
            issue_id: insertedIssue.id,
            rank_score: Math.round((issueCandidate.confidence ?? 0.5) * 100),
            confidence: issueCandidate.confidence ?? 0.5,
            mileage_start: null,
            mileage_end: null,
          });

        if (vehicleIssueError) {
          vehicleIssueLinkError = vehicleIssueError.message;
        } else {
          vehicleIssueLinked = true;
        }
      }

      const { error: updateCandidateError } = await supabaseAdmin
        .from("issue_candidates")
        .update({ status: "approved" })
        .eq("id", id);

      if (updateCandidateError) {
        return NextResponse.json(
          { error: updateCandidateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        promotedType: "issue",
        canonicalId: insertedIssue.id,
        vehicleIssueLinked,
        vehicleIssueLinkError,
      });
    }

    if (type === "job") {
      if (!issueId) {
        return NextResponse.json(
          { error: "issueId is required when promoting a job" },
          { status: 400 }
        );
      }

      const { data: candidate, error: candidateError } = await supabaseAdmin
        .from("job_candidates")
        .select("*")
        .eq("id", id)
        .single();

      const jobCandidate = candidate as JobCandidateRow | null;

      if (candidateError || !jobCandidate) {
        return NextResponse.json(
          { error: candidateError?.message ?? "Job candidate not found" },
          { status: 404 }
        );
      }

      const { data: insertedJob, error: insertJobError } = await supabaseAdmin
        .from("jobs")
        .insert({
          title: jobCandidate.title,
          layman_steps: jobCandidate.summary,
          difficulty: jobCandidate.difficulty,
          time_minutes_low: 60,
          time_minutes_high: 180,
          tool_list: "Basic hand tools",
          disclaimer:
            jobCandidate.difficulty === "expert"
              ? "Consider using a professional mechanic if you are not confident."
              : null,
        })
        .select("id")
        .single();

      if (insertJobError || !insertedJob) {
        return NextResponse.json(
          { error: insertJobError?.message ?? "Failed to create job" },
          { status: 500 }
        );
      }

      let issueJobLinked = false;
      let issueJobLinkError: string | null = null;

      const { error: issueJobError } = await supabaseAdmin
        .from("issue_jobs")
        .insert({
          issue_id: issueId,
          job_id: insertedJob.id,
          recommended_order: 1,
        });

      if (issueJobError) {
        issueJobLinkError = issueJobError.message;
      } else {
        issueJobLinked = true;
      }

      const { error: updateCandidateError } = await supabaseAdmin
        .from("job_candidates")
        .update({
          status: "approved",
          issue_id: issueId,
        })
        .eq("id", id);

      if (updateCandidateError) {
        return NextResponse.json(
          { error: updateCandidateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        promotedType: "job",
        canonicalId: insertedJob.id,
        issueJobLinked,
        issueJobLinkError,
      });
    }

    return NextResponse.json(
      { error: "Invalid type. Use 'issue' or 'job'." },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}