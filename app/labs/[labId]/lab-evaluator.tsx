"use client";

import { useMemo, useState } from "react";
import type { FeedbackV2 } from "@/lib/schemas";

type Attempt = {
  id: string;
  prompt_text: string;
  feedback_json: FeedbackV2 | null;
  score_total: number;
  created_at: string;
};

type EvaluateResponse =
  | { ok: true; attemptId: string; feedback: FeedbackV2 }
  | { ok: false; error: string; details?: string };

export function LabEvaluator({ labId, attempts }: { labId: string; attempts: Attempt[] }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackV2 | null>(attempts[0]?.feedback_json ?? null);
  const [history, setHistory] = useState<Attempt[]>(attempts);

  const latestScore = useMemo(() => feedback?.score_total ?? null, [feedback]);

  async function runEvaluation() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ labId, userPrompt: prompt })
      });

      const data: EvaluateResponse = await response.json();
      if (!data.ok) {
        setError(data.details ? `${data.error}: ${data.details}` : data.error);
        return;
      }

      setFeedback(data.feedback);
      setHistory((prev) => [
        {
          id: data.attemptId,
          prompt_text: prompt,
          feedback_json: data.feedback,
          score_total: data.feedback.score_total,
          created_at: new Date().toISOString()
        },
        ...prev
      ]);
    } catch {
      setError("Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function copyRewrite() {
    if (!feedback?.rewrite) return;
    try {
      await navigator.clipboard.writeText(feedback.rewrite);
    } catch {
      setError("Could not copy rewrite to clipboard.");
    }
  }

  return (
    <div className="card">
      <h2>Try your prompt</h2>
      <label>
        Prompt
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={10} />
      </label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" onClick={runEvaluation} disabled={loading || prompt.trim().length === 0}>
          {loading ? "Evaluating..." : "Evaluate"}
        </button>
        <button type="button" onClick={() => feedback?.rewrite && setPrompt(feedback.rewrite)} disabled={!feedback?.rewrite}>
          Apply rewrite
        </button>
        <button type="button" onClick={copyRewrite} disabled={!feedback?.rewrite}>
          Copy rewrite
        </button>
      </div>

      {error ? <p style={{ color: "#b91c1c" }}>{error}</p> : null}

      {feedback ? (
        <div style={{ display: "grid", gap: "1rem" }}>
          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Latest feedback (v2)</h3>
            <p>
              <strong>Score:</strong> {latestScore}
            </p>
            <p>
              <strong>Grader confidence:</strong> {feedback.grader_confidence}
            </p>
            <p>
              <strong>Highest-impact fix:</strong> {feedback.highest_impact_fix}
            </p>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Score breakdown</h3>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {Object.entries(feedback.score_breakdown).map(([key, value]) => (
                  <tr key={key}>
                    <td style={{ borderBottom: "1px solid #e5e7eb", padding: "0.5rem 0" }}>{key}</td>
                    <td style={{ borderBottom: "1px solid #e5e7eb", textAlign: "right" }}>{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Deductions</h3>
            {feedback.deductions.map((item, index) => (
              <div key={`${item.rubric_key}-${index}`} style={{ borderBottom: "1px solid #e5e7eb", paddingBottom: "0.75rem" }}>
                <p>
                  <strong>{item.rubric_key}</strong> (-{item.deduction})
                </p>
                <p>{item.reason}</p>
                <p style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={item.evidence}>
                  “{item.evidence}”
                </p>
                <p>
                  <strong>Fix:</strong> {item.fix}
                </p>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Rewrite</h3>
            <pre>{feedback.rewrite}</pre>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Change log</h3>
            <ul>
              {feedback.change_log.map((item, index) => (
                <li key={`${item.rubric_key}-${index}`}>
                  <strong>{item.rubric_key}:</strong> {item.change} — {item.why}
                </li>
              ))}
            </ul>
          </div>

          <div className="card" style={{ marginBottom: 0 }}>
            <h3>Checklist</h3>
            <ul>
              {feedback.checklist.map((item, index) => (
                <li key={`${item.item}-${index}`}>
                  {item.item} {" "}
                  <span
                    style={{
                      borderRadius: "999px",
                      padding: "0.1rem 0.4rem",
                      background: item.status === "pass" ? "#dcfce7" : item.status === "fail" ? "#fee2e2" : "#e5e7eb"
                    }}
                  >
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
            <p>{feedback.final_notes}</p>
          </div>
        </div>
      ) : null}

      <div className="card" style={{ marginTop: "1rem", marginBottom: 0 }}>
        <h3>Attempt history</h3>
        {history.length === 0 ? <p>No attempts yet.</p> : null}
        <ul>
          {history.map((attempt) => (
            <li key={attempt.id}>
              {new Date(attempt.created_at).toLocaleString()} — score {attempt.score_total}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
