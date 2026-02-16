import "server-only";
import OpenAI from "openai";
import { feedbackSchema } from "@/lib/schemas";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function evaluatePromptWithOpenAI(input: {
  labTitle: string;
  scenario: unknown;
  rubric: unknown;
  userPrompt: string;
}) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You evaluate prompt quality. Return JSON only with keys: score_total, score_breakdown, issues, rewrite, explanation, next_steps."
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "Evaluate this prompt for a prompt engineering lab using the supplied scenario and rubric.",
          labTitle: input.labTitle,
          scenario: input.scenario,
          rubric: input.rubric,
          prompt: input.userPrompt,
          output_contract: {
            score_total: "number 0-100",
            score_breakdown: "object of criterion to numeric score",
            issues: [{ title: "string", severity: "low|med|high", fix: "string" }],
            rewrite: "improved prompt",
            explanation: "why these edits improve quality",
            next_steps: ["actionable next step"]
          }
        })
      }
    ]
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned empty content");

  const parsed = JSON.parse(raw);
  return feedbackSchema.parse(parsed);
}
