import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_: Request, { params }: { params: { labId: string } }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pg_labs")
    .select("id, title, difficulty, scenario_json, rubric_json, created_at")
    .eq("id", params.labId)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });

  return NextResponse.json({ ok: true, lab: data });
}
