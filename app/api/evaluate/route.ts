import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gradePromptV2, GraderError } from "@/lib/openai";
import { evaluateRequestSchema, evaluateResponseSchema, feedbackV2Schema } from "@/lib/schemas";

export async function POST(request: Request) {
  const { user, response } = await requireUser();
  if (!user || response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = evaluateRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid request", details: parsed.error.message }, { status: 400 });
  }

  const { labId, userPrompt } = parsed.data;
  const supabase = createClient();

  const { data: lab, error: labError } = await supabase
    .from("pg_labs")
    .select("id, title, scenario_json, rubric_json, rubric_version")
    .eq("id", labId)
    .maybeSingle();

  if (labError) return NextResponse.json({ ok: false, error: labError.message }, { status: 500 });
  if (!lab) return NextResponse.json({ ok: false, error: "Lab not found" }, { status: 404 });

  const rubricSnapshot = {
    rubric_version: lab.rubric_version,
    rubric_json: lab.rubric_json,
    scenario_json: lab.scenario_json,
    captured_at: new Date().toISOString()
  };

  try {
    const graded = await gradePromptV2({
      scenario: lab.scenario_json,
      rubric: lab.rubric_json,
      rubricVersion: lab.rubric_version,
      userPrompt
    });

    const feedback = feedbackV2Schema.parse({
      feedback_version: "v2",
      rubric_version: graded.critique.rubric_version,
      score_total: graded.critique.score_total,
      score_breakdown: graded.critique.score_breakdown,
      deductions: graded.critique.deductions,
      missing: graded.critique.missing,
      strengths: graded.critique.strengths,
      grader_confidence: graded.critique.grader_confidence,
      highest_impact_fix: graded.critique.highest_impact_fix,
      rewrite: graded.rewrite.rewrite,
      change_log: graded.rewrite.change_log,
      checklist: graded.rewrite.checklist,
      final_notes: graded.rewrite.final_notes
    });

    const { data: attempt, error: attemptError } = await supabase
      .from("pg_lab_attempts")
      .insert({
        lab_id: labId,
        user_id: user.id,
        prompt_text: userPrompt,
        feedback_version: "v2",
        rubric_snapshot_json: rubricSnapshot,
        critique_json: graded.critique,
        rewrite_json: graded.rewrite,
        feedback_json: feedback,
        score_total: feedback.score_total,
        score_breakdown_json: feedback.score_breakdown,
        grader_confidence: feedback.grader_confidence,
        highest_impact_fix: feedback.highest_impact_fix,
        model_critique: graded.meta.modelCritique,
        model_rewrite: graded.meta.modelRewrite,
        tokens_in: graded.meta.tokensIn,
        tokens_out: graded.meta.tokensOut,
        latency_ms: graded.meta.latencyMs
      })
      .select("id")
      .single();

    if (attemptError) return NextResponse.json({ ok: false, error: attemptError.message }, { status: 500 });

    const responsePayload = evaluateResponseSchema.parse({
      ok: true,
      attemptId: attempt.id,
      feedback
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const details =
      error instanceof GraderError || error instanceof Error ? error.message.slice(0, 220) : "Unknown grading failure";

    return NextResponse.json(
      {
        ok: false,
        error: "Grading failed",
        details
      },
      { status: 422 }
    );
  }
}
