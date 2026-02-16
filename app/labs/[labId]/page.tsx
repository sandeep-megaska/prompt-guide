import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { feedbackV2Schema, type FeedbackV2 } from "@/lib/schemas";
import { LabEvaluator } from "./lab-evaluator";

type AttemptRow = {
  id: string;
  prompt_text: string;
  feedback_json: FeedbackV2 | null;
  score_total: number;
  created_at: string;
};

export default async function LabDetailPage({ params }: { params: { labId: string } }) {
  const supabase = createClient();
  const { data: lab, error } = await supabase
    .from("pg_labs")
    .select("id, title, difficulty, scenario_json, rubric_json, rubric_version")
    .eq("id", params.labId)
    .maybeSingle();

  if (error) return <p>Unable to load lab: {error.message}</p>;
  if (!lab) notFound();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  let attempts: AttemptRow[] = [];
  if (user) {
    const { data: attemptRows } = await supabase
      .from("pg_lab_attempts")
      .select("id, prompt_text, feedback_json, score_total, created_at")
      .eq("lab_id", lab.id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    attempts =
      attemptRows?.map((attempt) => {
        const parsedFeedback = feedbackV2Schema.safeParse(attempt.feedback_json);
        return {
          id: attempt.id,
          prompt_text: attempt.prompt_text,
          feedback_json: parsedFeedback.success ? parsedFeedback.data : null,
          score_total: Number(attempt.score_total),
          created_at: attempt.created_at
        };
      }) ?? [];
  }

  return (
    <section>
      <h1>{lab.title}</h1>
      <p>Difficulty: {lab.difficulty}</p>
      <p>Rubric version: {lab.rubric_version}</p>
      <div className="card">
        <h2>Scenario</h2>
        <pre>{JSON.stringify(lab.scenario_json, null, 2)}</pre>
      </div>
      <div className="card">
        <h2>Rubric</h2>
        <pre>{JSON.stringify(lab.rubric_json, null, 2)}</pre>
      </div>
      <LabEvaluator labId={lab.id} labTitle={lab.title} scenario={lab.scenario_json} rubric={lab.rubric_json} attempts={attempts} />
    </section>
  );
}
