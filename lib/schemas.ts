import { z } from "zod";

const deductionSchema = z.object({
  rubric_key: z.string().min(1),
  deduction: z.number().positive(),
  reason: z.string().min(1).max(240),
  evidence: z.string().min(1).max(220),
  fix: z.string().min(1).max(240)
});

const changeLogSchema = z.object({
  rubric_key: z.string().min(1),
  change: z.string().min(1),
  why: z.string().min(1)
});

const checklistItemSchema = z.object({
  item: z.string().min(1),
  status: z.enum(["pass", "fail", "n/a"])
});

export const critiqueSchema = z.object({
  rubric_version: z.string().min(1),
  score_total: z.number().min(0).max(100),
  score_breakdown: z.record(z.string(), z.number().min(0).max(100)),
  deductions: z.array(deductionSchema).max(12),
  missing: z.array(z.string().min(1)),
  strengths: z.array(z.string().min(1)),
  grader_confidence: z.number().min(0).max(100),
  highest_impact_fix: z.string().min(1).max(240)
});

export const rewriteSchema = z.object({
  rubric_version: z.string().min(1),
  rewrite: z.string().min(1).max(6000),
  change_log: z.array(changeLogSchema).max(12),
  checklist: z.array(checklistItemSchema).max(15),
  final_notes: z.string().min(1).max(600)
});

export const feedbackV2Schema = z.object({
  feedback_version: z.literal("v2"),
  rubric_version: z.string().min(1),
  score_total: z.number().min(0).max(100),
  score_breakdown: z.record(z.string(), z.number().min(0).max(100)),
  deductions: z.array(deductionSchema).max(12),
  missing: z.array(z.string().min(1)),
  strengths: z.array(z.string().min(1)),
  grader_confidence: z.number().min(0).max(100),
  highest_impact_fix: z.string().min(1).max(240),
  rewrite: z.string().min(1).max(6000),
  change_log: z.array(changeLogSchema).max(12),
  checklist: z.array(checklistItemSchema).max(15),
  final_notes: z.string().min(1).max(600)
});

export const evaluateRequestSchema = z.object({
  labId: z.string().uuid(),
  userPrompt: z.string().min(1).max(8000)
});

export const evaluateResponseSchema = z.object({
  ok: z.literal(true),
  attemptId: z.string().uuid(),
  feedback: feedbackV2Schema
});

export const evaluateErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
  details: z.string().optional()
});

export const evaluateApiResponseSchema = z.union([evaluateResponseSchema, evaluateErrorResponseSchema]);

export const attemptCreateSchema = z.object({
  labId: z.string().uuid(),
  promptText: z.string().min(1).max(10000),
  feedback: feedbackV2Schema.optional()
});

export type Critique = z.infer<typeof critiqueSchema>;
export type Rewrite = z.infer<typeof rewriteSchema>;
export type FeedbackV2 = z.infer<typeof feedbackV2Schema>;
