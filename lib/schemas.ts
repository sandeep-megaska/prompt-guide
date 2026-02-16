import { z } from "zod";

export const issueSchema = z.object({
  title: z.string().min(1),
  severity: z.enum(["low", "med", "high"]),
  fix: z.string().min(1)
});

export const feedbackSchema = z.object({
  score_total: z.number().min(0).max(100),
  score_breakdown: z.record(z.string(), z.number().min(0).max(100)),
  issues: z.array(issueSchema),
  rewrite: z.string().min(1),
  explanation: z.string().min(1),
  next_steps: z.array(z.string().min(1))
});

export const evaluateRequestSchema = z.object({
  labId: z.string().uuid(),
  userPrompt: z.string().min(1).max(10000)
});

export const evaluateResponseSchema = z.object({
  ok: z.literal(true),
  attemptId: z.string().uuid(),
  feedback: feedbackSchema
});

export const evaluateErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string()
});

export const attemptCreateSchema = z.object({
  labId: z.string().uuid(),
  promptText: z.string().min(1).max(10000),
  feedback: feedbackSchema.optional()
});
