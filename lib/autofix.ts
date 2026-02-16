import { getLabTemplate } from "@/lib/promptTemplates";

export type FixAction = {
  code: string;
  label: string;
  apply: (prompt: string) => string;
};

function prependIfMissing(prompt: string, line: string, check: RegExp): string {
  if (check.test(prompt)) return prompt;
  const trimmed = prompt.trim();
  if (trimmed.length === 0) return line;
  return `${line}\n${prompt}`;
}

function appendSectionIfMissing(prompt: string, heading: string, body: string, check: RegExp): string {
  if (check.test(prompt)) return prompt;
  const separator = prompt.trim().length === 0 ? "" : "\n\n";
  return `${prompt}${separator}${heading}:\n${body}`;
}

export function getFixActions(labTitle: string, rubric: unknown): FixAction[] {
  const normalizedTitle = labTitle.toLowerCase();
  const template = getLabTemplate(labTitle, rubric);
  const jsonSkeleton = "```json\n{\n  \"result\": \"string\",\n  \"confidence\": 0,\n  \"notes\": [\"string\"]\n}\n```";

  const actions: FixAction[] = [
    {
      code: "PROMPT_TOO_SHORT",
      label: "Insert scaffold template",
      apply: (prompt) => (prompt.trim().length === 0 ? template : prompt)
    },
    {
      code: "GOAL_UNCLEAR",
      label: "Add task line",
      apply: (prompt) => prependIfMissing(prompt, "Your task: [describe exactly what to produce].", /\byour task\s*:/i)
    },
    {
      code: "OUTPUT_FORMAT_MISSING",
      label: "Add output format section",
      apply: (prompt) => appendSectionIfMissing(prompt, "Output format", "Return a concise answer in bullet points.", /\boutput format\b/i)
    },
    {
      code: "JSON_REQUIRED",
      label: "Add JSON requirement",
      apply: (prompt) => {
        const withRequirement = prependIfMissing(prompt, "Return JSON only.", /\breturn\s+json\s+only\b/i);
        return appendSectionIfMissing(withRequirement, "JSON schema", jsonSkeleton, /```\s*json[\s\S]*?```/i);
      }
    },
    {
      code: "SELF_CHECK_MISSING",
      label: "Add checklist",
      apply: (prompt) =>
        appendSectionIfMissing(
          prompt,
          "Self-check",
          "- I followed all constraints\n- I used the requested format\n- I verified factual consistency",
          /\bself-check\b|\bchecklist\b/i
        )
    },
    {
      code: "CONSTRAINTS_MISSING",
      label: "Add constraints",
      apply: (prompt) =>
        appendSectionIfMissing(prompt, "Constraints", "- Use at most 5 bullets\n- Do not include speculation\n- Keep each item under 20 words", /\bconstraints?\b/i)
    },
    {
      code: "ROLE_MISSING",
      label: "Add role framing",
      apply: (prompt) => prependIfMissing(prompt, "You are a helpful domain expert.", /\byou are\b|\bact as\b/i)
    }
  ];

  if (normalizedTitle.includes("structured output")) {
    return actions;
  }

  return actions;
}
