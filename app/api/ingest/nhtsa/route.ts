import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import crypto from "crypto";

export const dynamic = "force-dynamic";

type NhtsaComplaint = {
  ODINumber?: number | string;
  manufacturer?: string;
  crash?: boolean;
  fire?: boolean;
  numberOfDeaths?: number;
  numberOfInjuries?: number;
  components?: string;
  summary?: string;
  productDescription?: string;
};

function makeContentHash(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function buildRawText(complaint: NhtsaComplaint, make: string, model: string, year: string) {
  return [
    `ODI Number: ${complaint.ODINumber ?? ""}`,
    `Vehicle: ${year} ${make} ${model}`,
    `Components: ${complaint.components ?? ""}`,
    `Summary: ${complaint.summary ?? ""}`,
    `Crash: ${complaint.crash ? "Yes" : "No"}`,
    `Fire: ${complaint.fire ? "Yes" : "No"}`,
    `Deaths: ${complaint.numberOfDeaths ?? 0}`,
    `Injuries: ${complaint.numberOfInjuries ?? 0}`,
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
    const vehicleGenerationId = body.vehicleGenerationId
      ? String(body.vehicleGenerationId).trim()
      : null;

    console.log("[ingest/nhtsa] Request params:", { make, model, year, vehicleGenerationId });

    if (!make || !model || !year) {
      return NextResponse.json(
        { error: "make, model, and year are required" },
        { status: 400 }
      );
    }

    // --- NHTSA fetch ---
    const nhtsaUrl = `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${encodeURIComponent(make)}&model=${encodeURIComponent(model)}&modelYear=${encodeURIComponent(year)}`;
    console.log("[ingest/nhtsa] Fetching:", nhtsaUrl);

    const res = await fetch(nhtsaUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[ingest/nhtsa] NHTSA fetch failed:", res.status, res.statusText);
      return NextResponse.json(
        { error: `NHTSA request failed with status ${res.status}` },
        { status: 502 }
      );
    }

    const json = await res.json();
    const complaints: NhtsaComplaint[] = Array.isArray(json.results) ? json.results : [];
    console.log("[ingest/nhtsa] Complaints returned from NHTSA:", complaints.length);

    if (complaints.length === 0) {
      console.log("[ingest/nhtsa] No complaints found — nothing to insert.");
      return NextResponse.json({ ok: true, fetched: 0, inserted: 0, skipped: 0 });
    }

    // Log a sample complaint to confirm shape
    console.log("[ingest/nhtsa] Sample complaint[0]:", JSON.stringify(complaints[0], null, 2));

    // --- Build rows ---
    const rows = complaints.map((complaint) => {
      const rawText = buildRawText(complaint, make, model, year);
      return {
        content_hash: makeContentHash(rawText),
        document_type: "nhtsa_complaint",
        status: "new",
        vehicle_generation_id: vehicleGenerationId,
        external_id: complaint.ODINumber ? String(complaint.ODINumber) : null,
        title: `${year} ${make} ${model} — ${complaint.components ?? "complaint"}`.trim(),
        raw_text: rawText,
        raw_json: {
          ...complaint,
          metadata: { make, model, year, vehicle_generation_id: vehicleGenerationId },
        },
        url: nhtsaUrl,
      };
    });

    console.log("[ingest/nhtsa] Rows to upsert:", rows.length);
    console.log("[ingest/nhtsa] Sample row[0] fields:", {
      content_hash: rows[0].content_hash,
      document_type: rows[0].document_type,
      vehicle_generation_id: rows[0].vehicle_generation_id,
      external_id: rows[0].external_id,
      title: rows[0].title,
    });

    // --- Upsert into source_documents ---
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("source_documents")
      .upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true })
      .select("id");

    if (insertError) {
      console.error("[ingest/nhtsa] Supabase upsert error:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const insertedCount = inserted?.length ?? 0;
    const skipped = complaints.length - insertedCount;

    console.log("[ingest/nhtsa] Upsert complete — inserted:", insertedCount, "skipped (duplicates):", skipped);

    return NextResponse.json({
      ok: true,
      fetched: complaints.length,
      inserted: insertedCount,
      skipped,
      vehicle: { make, model, year, vehicleGenerationId },
    });
  } catch (error) {
    console.error("[ingest/nhtsa] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
