import "server-only";
import OpenAI from "openai";
import { ZodType } from "zod";
import { critiqueSchema, rewriteSchema, type Critique, type Rewrite } from "@/lib/schemas";

const MODEL_CRITIQUE = process.env.OPENAI_MODEL_CRITIQUE ?? "gpt-4.1-mini";
const MODEL_REWRITE = process.env.OPENAI_MODEL_REWRITE ?? "gpt-4.1-mini";

export class GraderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraderError";
  }
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new GraderError("Missing OPENAI_API_KEY");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parseJsonFromContent(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new GraderError("Model returned invalid JSON");
  }
}

function extractRubricKeys(rubric: unknown): string[] {
  if (!rubric || typeof rubric !== "object") return [];

  const objectRubric = rubric as Record<string, unknown>;
  const criteria = objectRubric.criteria;
  const source = criteria && typeof criteria === "object" ? (criteria as Record<string, unknown>) : objectRubric;

  const keys = new Set<string>();
  const walk = (obj: Record<string, unknown>, prefix?: string) => {
    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      keys.add(fullKey);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        walk(value as Record<string, unknown>, fullKey);
      }
    });
  };

  walk(source);
  return Array.from(keys);
}

function validateRubricKeys(rubricKeys: string[], critique: Critique, rewrite: Rewrite) {
  const rubricSet = new Set(rubricKeys);
  const allDeductionKeysValid = critique.deductions.every((item) => rubricSet.has(item.rubric_key));
  const allBreakdownKeysValid = Object.keys(critique.score_breakdown).every((key) => rubricSet.has(key));
  const allChangeLogKeysValid = rewrite.change_log.every((entry) => rubricSet.has(entry.rubric_key));

  if (!allDeductionKeysValid || !allBreakdownKeysValid || !allChangeLogKeysValid) {
    throw new GraderError("Model output used rubric keys that do not exist in rubric_json");
  }
}

async function runJsonCall<T>(params: {
  client: OpenAI;
  model: string;
  temperature: number;
  schema: ZodType<T>;
  systemPrompt: string;
  userPayload: Record<string, unknown>;
}): Promise<{ parsed: T; tokensIn: number | null; tokensOut: number | null }> {
  const attemptCall = async (extraSystemPrompt?: string, lastOutput?: string) => {
    const completion = await params.client.chat.completions.create({
      model: params.model,
      temperature: params.temperature,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: params.systemPrompt },
        ...(extraSystemPrompt ? [{ role: "system" as const, content: extraSystemPrompt }] : []),
        {
          role: "user",
          content: JSON.stringify({
            ...params.userPayload,
            previous_invalid_output: lastOutput
          })
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new GraderError("OpenAI returned empty content");
    }

    const parsedJson = parseJsonFromContent(raw);
    const parsed = params.schema.parse(parsedJson);

    return {
      parsed,
      raw,
      usage: completion.usage
    };
  };

  try {
    const first = await attemptCall();
    return {
      parsed: first.parsed,
      tokensIn: first.usage?.prompt_tokens ?? null,
      tokensOut: first.usage?.completion_tokens ?? null
    };
  } catch (firstError) {
    const previous = firstError instanceof Error ? firstError.message : "unknown error";
    try {
      const second = await attemptCall(
        "Your last output failed schema validation. Return corrected JSON only. Follow the schema exactly.",
        previous
      );
      return {
        parsed: second.parsed,
        tokensIn: second.usage?.prompt_tokens ?? null,
        tokensOut: second.usage?.completion_tokens ?? null
      };
    } catch (secondError) {
      const message = secondError instanceof Error ? secondError.message : "Unknown grading failure";
      throw new GraderError(message);
    }
  }
}

export async function gradePromptV2(args: {
  scenario: unknown;
  rubric: unknown;
  rubricVersion: string;
  userPrompt: string;
}): Promise<{
  critique: Critique;
  rewrite: Rewrite;
  meta: {
    modelCritique: string;
    modelRewrite: string;
    tokensIn: number | null;
    tokensOut: number | null;
    latencyMs: number;
  };
}> {
  const client = getOpenAIClient();
  const startedAt = Date.now();
  const rubricKeys = extractRubricKeys(args.rubric);

  if (rubricKeys.length === 0) {
    throw new GraderError("rubric_json has no valid keys to evaluate against");
  }

  try {
    const critiqueResult = await runJsonCall({
      client,
      model: MODEL_CRITIQUE,
      temperature: 0.2,
      schema: critiqueSchema,
      systemPrompt:
        "You are a strict prompt grader. Return ONLY valid JSON. No markdown. No commentary. Map all deductions and score_breakdown keys to rubric keys provided in rubric_keys. Evidence must be an exact quote from userPrompt. Ensure score_total equals 100 - sum(deductions.deduction), allowing only minor rounding adjustments.",
      userPayload: {
        task: "Critique pass",
        rubric_version: args.rubricVersion,
        rubric_keys: rubricKeys,
        scenario_json: args.scenario,
        rubric_json: args.rubric,
        userPrompt: args.userPrompt,
        schema: {
          rubric_version: "string",
          score_total: "number 0-100",
          score_breakdown: "record<rubric_key, number 0-100>",
          deductions: [
            {
              rubric_key: "string",
              deduction: "positive number",
              reason: "string max 240",
              evidence: "string max 220",
              fix: "string max 240"
            }
          ],
          missing: ["string"],
          strengths: ["string"],
          grader_confidence: "number 0-100",
          highest_impact_fix: "string max 240"
        }
      }
    });

    const rewriteResult = await runJsonCall({
      client,
      model: MODEL_REWRITE,
      temperature: 0.3,
      schema: rewriteSchema,
      systemPrompt:
        "You are a strict prompt rewriter. Return ONLY valid JSON. No markdown. No commentary. Use critique_json directly and produce an improved prompt rewrite plus a rubric-mapped change_log.",
      userPayload: {
        task: "Rewrite pass",
        rubric_version: args.rubricVersion,
        rubric_keys: rubricKeys,
        scenario_json: args.scenario,
        rubric_json: args.rubric,
        userPrompt: args.userPrompt,
        critique_json: critiqueResult.parsed,
        schema: {
          rubric_version: "string",
          rewrite: "string <= 6000 chars",
          change_log: [
            {
              rubric_key: "string",
              change: "string",
              why: "string"
            }
          ],
          checklist: [
            {
              item: "string",
              status: "pass|fail|n/a"
            }
          ],
          final_notes: "string <= 600 chars"
        }
      }
    });

    validateRubricKeys(rubricKeys, critiqueResult.parsed, rewriteResult.parsed);

    return {
      critique: critiqueResult.parsed,
      rewrite: rewriteResult.parsed,
      meta: {
        modelCritique: MODEL_CRITIQUE,
        modelRewrite: MODEL_REWRITE,
        tokensIn:
          (critiqueResult.tokensIn ?? 0) + (rewriteResult.tokensIn ?? 0) > 0
            ? (critiqueResult.tokensIn ?? 0) + (rewriteResult.tokensIn ?? 0)
            : null,
        tokensOut:
          (critiqueResult.tokensOut ?? 0) + (rewriteResult.tokensOut ?? 0) > 0
            ? (critiqueResult.tokensOut ?? 0) + (rewriteResult.tokensOut ?? 0)
            : null,
        latencyMs: Date.now() - startedAt
      }
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI grading error";
    throw new GraderError(message);
  }
}
