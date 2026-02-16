import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { evaluatePromptWithOpenAI } from "@/lib/openai";
import { evaluateRequestSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user || response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = evaluateRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const { labId, userPrompt } = parsed.data;
  const supabase = createClient();

  const { data: lab, error: labError } = await supabase
    .from("pg_labs")
    .select("id, title, scenario_json, rubric_json")
    .eq("id", labId)
    .maybeSingle();

  if (labError) return NextResponse.json({ ok: false, error: labError.message }, { status: 500 });
  if (!lab) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });

  let feedback;
  try {
    feedback = await evaluatePromptWithOpenAI({
      labTitle: lab.title,
      scenario: lab.scenario_json,
      rubric: lab.rubric_json,
      userPrompt
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Failed to parse model output" },
      { status: 422 }
    );
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("pg_lab_attempts")
    .insert({
      lab_id: labId,
      user_id: user.id,
      prompt_text: userPrompt,
      feedback_json: feedback,
      score_total: feedback.score_total,
      score_breakdown_json: feedback.score_breakdown
    })
    .select("id")
    .single();

  if (attemptError) return NextResponse.json({ ok: false, error: attemptError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    attemptId: attempt.id,
    feedback
  });
}
