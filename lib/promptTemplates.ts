export type TemplateBlock = { id: string; title: string; content: string };

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) return null;
  return value as Record<string, unknown>;
}

function hasRequiredField(rubric: unknown, field: string): boolean {
  const rubricObj = asObject(rubric);
  const lintObj = rubricObj ? asObject(rubricObj.lint) : null;
  const required = lintObj?.required;
  return Array.isArray(required) && required.some((item) => item === field);
}

function buildTemplateBlocks(labTitle: string, rubric: unknown): TemplateBlock[] {
  const normalizedTitle = labTitle.toLowerCase();
  const isStructuredOutput = normalizedTitle.includes("structured output");
  const isFewShot = normalizedTitle.includes("few-shot");
  const isSelfCheck = normalizedTitle.includes("self-check") || hasRequiredField(rubric, "self_check");

  const blocks: TemplateBlock[] = [
    {
      id: "role",
      title: "Role",
      content: "You are an expert assistant specialized in this lab's domain."
    },
    {
      id: "task",
      title: "Task",
      content: "Your task: [describe the exact objective and success criteria]."
    },
    {
      id: "context",
      title: "Context",
      content: "Use the following context: [insert relevant background, constraints, and assumptions]."
    },
    {
      id: "constraints",
      title: "Constraints",
      content: "- Must follow lab requirements.\n- Do not invent unsupported facts.\n- Keep response concise and grounded."
    },
    {
      id: "output-format",
      title: "Output Format",
      content: isStructuredOutput
        ? "Return JSON only using this structure:\n```json\n{\n  \"result\": \"string\",\n  \"confidence\": 0,\n  \"notes\": [\"string\"]\n}\n```"
        : "Return a clear answer using numbered steps or bullet points."
    }
  ];

  if (isFewShot) {
    blocks.push({
      id: "examples",
      title: "Examples",
      content: "Example Input:\n[input here]\n\nExample Output:\n[output here]"
    });
  }

  if (isSelfCheck) {
    blocks.push({
      id: "self-check",
      title: "Self-check",
      content: "Before final answer, verify:\n- The task is fully addressed\n- Constraints are satisfied\n- Output format matches requirements"
    });
  }

  return blocks;
}

export function getLabTemplate(labTitle: string, rubric: unknown): string {
  const blocks = buildTemplateBlocks(labTitle, rubric);
  return blocks.map((block) => `${block.title}:\n${block.content}`).join("\n\n");
}
