import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body.type ?? "");
    const id = String(body.id ?? "");

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

      if (candidateError || !candidate) {
        return NextResponse.json(
          { error: candidateError?.message ?? "Issue candidate not found" },
          { status: 404 }
        );
      }

      const { data: insertedIssue, error: insertError } = await supabaseAdmin
        .from("issues")
        .insert({
          title: candidate.title,
          summary: candidate.summary,
          system_tag: "general",
          safety_level: 0,
        })
        .select("id")
        .single();

      if (insertError || !insertedIssue) {
        return NextResponse.json(
          { error: insertError?.message ?? "Failed to create issue" },
          { status: 500 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("issue_candidates")
        .update({ status: "approved" })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        promotedType: "issue",
        canonicalId: insertedIssue.id,
      });
    }

    if (type === "job") {
      const { data: candidate, error: candidateError } = await supabaseAdmin
        .from("job_candidates")
        .select("*")
        .eq("id", id)
        .single();

      if (candidateError || !candidate) {
        return NextResponse.json(
          { error: candidateError?.message ?? "Job candidate not found" },
          { status: 404 }
        );
      }

      const { data: insertedJob, error: insertError } = await supabaseAdmin
        .from("jobs")
        .insert({
          title: candidate.title,
          layman_steps: candidate.summary,
          difficulty: candidate.difficulty,
          time_minutes_low: 60,
          time_minutes_high: 180,
          tool_list: "Basic hand tools",
          disclaimer:
            candidate.difficulty === "expert"
              ? "Consider using a professional mechanic if you are not confident."
              : null,
        })
        .select("id")
        .single();

      if (insertError || !insertedJob) {
        return NextResponse.json(
          { error: insertError?.message ?? "Failed to create job" },
          { status: 500 }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from("job_candidates")
        .update({ status: "approved" })
        .eq("id", id);

      if (updateError) {
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        ok: true,
        promotedType: "job",
        canonicalId: insertedJob.id,
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
