import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attemptCreateSchema } from "@/lib/schemas";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user || response) return response;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("pg_lab_attempts")
    .select("id, lab_id, prompt_text, feedback_json, score_total, score_breakdown_json, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, attempts: data });
}

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user || response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = attemptCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { labId, promptText, feedback } = parsed.data;
  const supabase = createClient();
  const insertPayload = {
    lab_id: labId,
    user_id: user.id,
    prompt_text: promptText,
    feedback_json: feedback ?? null,
    score_total: feedback?.score_total ?? 0,
    score_breakdown_json: feedback?.score_breakdown ?? null
  };

  const { data, error } = await supabase
    .from("pg_lab_attempts")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, attemptId: data.id });
}
