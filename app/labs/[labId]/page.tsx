import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LabDetailPage({ params }: { params: { labId: string } }) {
  const supabase = createClient();
  const { data: lab, error } = await supabase
    .from("pg_labs")
    .select("id, title, difficulty, scenario_json, rubric_json")
    .eq("id", params.labId)
    .maybeSingle();

  if (error) return <p>Unable to load lab: {error.message}</p>;
  if (!lab) notFound();

  return (
    <section>
      <h1>{lab.title}</h1>
      <p>Difficulty: {lab.difficulty}</p>
      <div className="card">
        <h2>Scenario</h2>
        <pre>{JSON.stringify(lab.scenario_json, null, 2)}</pre>
      </div>
      <div className="card">
        <h2>Rubric</h2>
        <pre>{JSON.stringify(lab.rubric_json, null, 2)}</pre>
      </div>
    </section>
  );
}
