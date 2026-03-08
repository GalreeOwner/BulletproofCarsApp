import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body.url ?? "").trim();
    const name = String(body.name ?? "Dealer Page").trim();

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let { data: source } = await supabaseAdmin
      .from("sources")
      .select("id")
      .eq("source_type", "dealer")
      .eq("name", name)
      .maybeSingle();

    if (!source) {
      const { data: inserted, error: sourceInsertError } = await supabaseAdmin
        .from("sources")
        .insert({
          source_type: "dealer",
          name,
          base_url: url,
        })
        .select("id")
        .single();

      if (sourceInsertError || !inserted) {
        return NextResponse.json(
          { error: sourceInsertError?.message ?? "Failed to create dealer source" },
          { status: 500 }
        );
      }

      source = inserted;
    }

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed with status ${res.status}` },
        { status: 502 }
      );
    }

    const html = await res.text();
    const rawText = stripHtml(html);

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? url;

    const { error: insertError } = await supabaseAdmin
      .from("source_documents")
      .upsert(
        {
          source_id: source.id,
          url,
          title,
          raw_text: rawText,
          raw_json: { fetched_from: url },
          document_type: "dealer_page",
          status: "new",
        },
        { onConflict: "url" }
      );

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      url,
      title,
      stored: true,
      chars: rawText.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}