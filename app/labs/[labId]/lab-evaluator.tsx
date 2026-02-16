"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeedbackV2 } from "@/lib/schemas";
import { lintPrompt, type LintIssue } from "@/lib/linter";

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

export function LabEvaluator({
  labId,
  labTitle,
  scenario,
  rubric,
  attempts
}: {
  labId: string;
  labTitle: string;
  scenario: unknown;
  rubric: unknown;
  attempts: Attempt[];
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackV2 | null>(attempts[0]?.feedback_json ?? null);
  const [history, setHistory] = useState<Attempt[]>(attempts);
  const [lintIssues, setLintIssues] = useState<LintIssue[]>([]);
  const [lintStats, setLintStats] = useState({ length: 0, hasJson: false, hasBullets: false });

  const latestScore = useMemo(() => feedback?.score_total ?? null, [feedback]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const lintResult = lintPrompt({
        labTitle,
        scenario,
        rubric,
        userPrompt: prompt
      });
      setLintIssues(lintResult.issues);
      setLintStats(lintResult.stats);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [labTitle, prompt, rubric, scenario]);

  const lintCounts = useMemo(
    () => ({
      error: lintIssues.filter((issue) => issue.severity === "error").length,
      warn: lintIssues.filter((issue) => issue.severity === "warn").length,
      info: lintIssues.filter((issue) => issue.severity === "info").length
    }),
    [lintIssues]
  );

  const groupedIssues = useMemo(
    () => ({
      error: lintIssues.filter((issue) => issue.severity === "error"),
      warn: lintIssues.filter((issue) => issue.severity === "warn"),
      info: lintIssues.filter((issue) => issue.severity === "info")
    }),
    [lintIssues]
  );

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

      <div className="card" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.5rem" }}>Lint</h3>
        <p style={{ marginBottom: "0.5rem" }}>
          Errors: <strong>{lintCounts.error}</strong> · Warnings: <strong>{lintCounts.warn}</strong> · Info: <strong>{lintCounts.info}</strong>
        </p>
        <p style={{ marginBottom: "0.5rem", color: "#6b7280" }}>Fix errors to run grading. Warnings are optional.</p>
        <p style={{ marginBottom: "0.75rem", color: "#6b7280" }}>
          Length: {lintStats.length} · JSON detected: {lintStats.hasJson ? "yes" : "no"} · Bullets detected: {lintStats.hasBullets ? "yes" : "no"}
        </p>

        {(["error", "warn", "info"] as const).map((severity) => (
          <div key={severity} style={{ marginBottom: "0.5rem" }}>
            <h4 style={{ textTransform: "capitalize", marginBottom: "0.25rem" }}>{severity}</h4>
            {groupedIssues[severity].length === 0 ? (
              <p style={{ color: "#6b7280" }}>No {severity} issues.</p>
            ) : (
              <ul>
                {groupedIssues[severity].map((issue, index) => (
                  <li key={`${issue.code}-${index}`} style={{ marginBottom: "0.5rem" }}>
                    <strong>{issue.title}</strong>
                    <p>{issue.message}</p>
                    <p>
                      <strong>Fix:</strong> {issue.fix}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <button type="button" onClick={runEvaluation} disabled={loading || prompt.trim().length === 0 || lintCounts.error > 0}>
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
                  {item.item}{" "}
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
