import Link from "next/link";

export default function HomePage() {
  return (
    <section>
      <h1>Prompt Guide</h1>
      <p>Learn practical prompt engineering with labs, structured feedback, and iterative refinement.</p>
      <div className="card">
        <h2>Get started</h2>
        <ul>
          <li><Link href="/signup">Create an account</Link></li>
          <li><Link href="/labs">Browse labs</Link></li>
          <li>Submit your prompt and get scored feedback instantly.</li>
        </ul>
      </div>
    </section>
  );
}
