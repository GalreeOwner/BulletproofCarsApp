import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

type NhtsaRecallResult = {
  NHTSACampaignNumber?: string;
  ReportReceivedDate?: string;
  Component?: string;
  Summary?: string;
  Consequence?: string;
  Remedy?: string;
  Notes?: string;
};

function buildRawText(row: NhtsaRecallResult) {
  return [
    `Campaign: ${row.NHTSACampaignNumber ?? ""}`,
    `Date: ${row.ReportReceivedDate ?? ""}`,
    `Component: ${row.Component ?? ""}`,
    `Summary: ${row.Summary ?? ""}`,
    `Consequence: ${row.Consequence ?? ""}`,
    `Remedy: ${row.Remedy ?? ""}`,
    `Notes: ${row.Notes ?? ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const make = String(body.make ?? "").trim();
    const model = String(body.model ?? "").trim();
    const year = String(body.year ?? "").trim();

    if (!make || !model || !year) {
      return NextResponse.json(
        { error: "make, model, and year are required" },
        { status: 400 }
      );
    }

    const { data: source, error: sourceError } = await supabaseAdmin
      .from("sources")
      .select("id")
      .eq("source_type", "nhtsa")
      .maybeSingle();

    if (sourceError || !source) {
      return NextResponse.json(
        { error: "NHTSA source row not found in sources table" },
        { status: 500 }
      );
    }

    const url = `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${encodeURIComponent(
      make
    )}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `NHTSA request failed with status ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const results: NhtsaRecallResult[] = Array.isArray(json.results) ? json.results : [];

    const rows = results.map((row) => ({
      source_id: source.id,
      external_id: row.NHTSACampaignNumber ?? null,
      url,
      title: `${year} ${make} ${model} recall ${row.NHTSACampaignNumber ?? ""}`.trim(),
      raw_text: buildRawText(row),
      raw_json: row,
      document_type: "nhtsa_recall",
      status: "new",
    }));

    if (rows.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("source_documents")
        .upsert(rows, {
          onConflict: "source_id,external_id",
          ignoreDuplicates: false,
        });

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      fetched: results.length,
      stored: rows.length,
      vehicle: { make, model, year },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}