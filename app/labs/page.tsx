import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function LabsPage() {
  const supabase = createClient();
  const { data: labs, error } = await supabase
    .from("pg_labs")
    .select("id, title, difficulty")
    .order("created_at", { ascending: true });

  if (error) return <p>Unable to load labs: {error.message}</p>;

  return (
    <section>
      <h1>Labs</h1>
      {labs?.map((lab) => (
        <article className="card" key={lab.id}>
          <h2>{lab.title}</h2>
          <p>Difficulty: {lab.difficulty}</p>
          <Link href={`/labs/${lab.id}`}>Open lab</Link>
        </article>
      ))}
    </section>
  );
}
