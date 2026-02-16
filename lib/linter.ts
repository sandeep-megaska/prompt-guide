export type LintSeverity = "info" | "warn" | "error";

export type LintIssue = {
  code: string;
  severity: LintSeverity;
  title: string;
  message: string;
  fix: string;
};

type LintConfig = {
  required: string[];
  min_length: number;
  max_length: number;
  banned_phrases: string[];
  require_json_output: boolean;
  require_examples: boolean;
};

const DEFAULT_LINT_CONFIG: LintConfig = {
  required: ["goal", "role", "constraints", "output_format", "examples", "self_check"],
  min_length: 80,
  max_length: 8000,
  banned_phrases: ["do anything", "ignore previous", "jailbreak"],
  require_json_output: false,
  require_examples: false
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseLintConfig(rubric: unknown, labTitle: string): LintConfig {
  const normalizedTitle = labTitle.toLowerCase();
  const fromRubric = isRecord(rubric) && isRecord(rubric.lint) ? rubric.lint : null;

  const requiredFromRubric = Array.isArray(fromRubric?.required)
    ? fromRubric.required.filter((item): item is string => typeof item === "string")
    : DEFAULT_LINT_CONFIG.required;

  const merged: LintConfig = {
    required: [...requiredFromRubric],
    min_length: typeof fromRubric?.min_length === "number" ? fromRubric.min_length : DEFAULT_LINT_CONFIG.min_length,
    max_length: typeof fromRubric?.max_length === "number" ? fromRubric.max_length : DEFAULT_LINT_CONFIG.max_length,
    banned_phrases: Array.isArray(fromRubric?.banned_phrases)
      ? fromRubric.banned_phrases.filter((item): item is string => typeof item === "string")
      : DEFAULT_LINT_CONFIG.banned_phrases,
    require_json_output:
      typeof fromRubric?.require_json_output === "boolean" ? fromRubric.require_json_output : DEFAULT_LINT_CONFIG.require_json_output,
    require_examples:
      typeof fromRubric?.require_examples === "boolean" ? fromRubric.require_examples : DEFAULT_LINT_CONFIG.require_examples
  };

  if (normalizedTitle.includes("structured output")) {
    merged.require_json_output = true;
    if (!merged.required.includes("output_format")) merged.required.push("output_format");
  }

  if (normalizedTitle.includes("few-shot")) {
    merged.require_examples = true;
    if (!merged.required.includes("examples")) merged.required.push("examples");
  }

  if (normalizedTitle.includes("self-check") && !merged.required.includes("self_check")) {
    merged.required.push("self_check");
  }

  return merged;
}

function includesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function hasJsonSkeleton(text: string): boolean {
  const fencedJsonPattern = /```\s*json[\s\S]*?```/i;
  const inlineJsonPattern = /\{\s*"[^"]+"\s*:/;
  return fencedJsonPattern.test(text) || inlineJsonPattern.test(text);
}

export function lintPrompt(args: {
  labTitle: string;
  scenario: unknown;
  rubric: unknown;
  userPrompt: string;
}): { ok: boolean; issues: LintIssue[]; stats: { length: number; hasJson: boolean; hasBullets: boolean } } {
  const { labTitle, rubric, userPrompt } = args;
  void args.scenario;

  const config = parseLintConfig(rubric, labTitle);
  const trimmedPrompt = userPrompt.trim();
  const loweredPrompt = trimmedPrompt.toLowerCase();

  const hasJsonKeyword = /\bjson\b/i.test(trimmedPrompt);
  const hasJsonStructure = hasJsonSkeleton(trimmedPrompt);
  const hasJson = hasJsonKeyword && hasJsonStructure;
  const hasBullets = /(^|\n)\s*[-*•]\s+/.test(trimmedPrompt) || /(^|\n)\s*\d+\.\s+/.test(trimmedPrompt);

  const issues: LintIssue[] = [];

  if (trimmedPrompt.length < config.min_length) {
    issues.push({
      code: "length_min",
      severity: "error",
      title: "Prompt too short",
      message: `Your prompt is ${trimmedPrompt.length} characters; minimum is ${config.min_length}.`,
      fix: "Add task details, constraints, and expected output format to reach a usable level of specificity."
    });
  }

  if (trimmedPrompt.length > config.max_length) {
    issues.push({
      code: "length_max",
      severity: "error",
      title: "Prompt too long",
      message: `Your prompt is ${trimmedPrompt.length} characters; maximum is ${config.max_length}.`,
      fix: "Remove repetition and keep only the highest-impact instructions."
    });
  }

  const taskVerbPatterns = [
    /\bwrite\b/i,
    /\bgenerate\b/i,
    /\bsummarize\b/i,
    /\bextract\b/i,
    /\bclassify\b/i,
    /\banalyze\b/i,
    /\bdesign\b/i
  ];

  if (!includesAny(trimmedPrompt, taskVerbPatterns)) {
    issues.push({
      code: "goal_missing",
      severity: "error",
      title: "Goal is unclear",
      message: "No explicit task verb was found, so the model's objective may be ambiguous.",
      fix: "Add a clear line such as: 'Your task: summarize the transcript into 5 bullet points.'"
    });
  }

  const constraintPatterns = [/\bmust\b/i, /\bdo not\b/i, /\bavoid\b/i, /\blimit\b/i, /\bonly\b/i, /\bat most\b/i, /\bexactly\b/i];
  const hasConstraints = includesAny(trimmedPrompt, constraintPatterns);
  const isConstraintsLab = labTitle.toLowerCase().includes("constraints");

  if (!hasConstraints) {
    issues.push({
      code: "constraints_missing",
      severity: isConstraintsLab ? "error" : "warn",
      title: "Constraints are missing",
      message: "No clear constraint markers were found.",
      fix: "Add enforceable limits, for example: 'Use at most 5 bullets' and 'Do not include speculation.'"
    });
  }

  const outputFormatPatterns = [/\breturn\b/i, /\bformat\b/i, /\bjson\b/i, /\btable\b/i, /\bbullet\b/i, /\bsteps\b/i];
  const hasOutputFormatHints = includesAny(trimmedPrompt, outputFormatPatterns);
  const isStructuredOutputLab = labTitle.toLowerCase().includes("structured output");

  if (!hasOutputFormatHints) {
    issues.push({
      code: "output_format_missing",
      severity: isStructuredOutputLab ? "error" : "warn",
      title: "Output format not specified",
      message: "The prompt does not clearly define how the answer should be formatted.",
      fix: "Specify an exact format, such as bullets, numbered steps, table columns, or JSON keys."
    });
  }

  if (config.require_json_output && !hasJson) {
    issues.push({
      code: "json_required",
      severity: "error",
      title: "JSON output requirement not met",
      message: "This lab requires explicit JSON instructions with a schema-like example.",
      fix: "Add 'Return valid JSON only' and include a JSON skeleton like {\"field\": \"value\"}."
    });
  }

  const hasExampleSection = /\bexample\b/i.test(trimmedPrompt) || (/\binput\s*:/i.test(trimmedPrompt) && /\boutput\s*:/i.test(trimmedPrompt));
  if (config.require_examples && !hasExampleSection) {
    issues.push({
      code: "examples_required",
      severity: "error",
      title: "Examples required",
      message: "This lab expects at least one clear example pair.",
      fix: "Add an example block with 'Input:' and 'Output:' to demonstrate target behavior."
    });
  }

  const selfCheckRequired = config.required.includes("self_check");
  const hasSelfCheck = /\bchecklist\b/i.test(trimmedPrompt) || /\bverify\b/i.test(trimmedPrompt) || /\bdouble-check\b/i.test(trimmedPrompt) || /\bvalidate\b/i.test(trimmedPrompt);
  if (selfCheckRequired && !hasSelfCheck) {
    issues.push({
      code: "self_check_required",
      severity: "error",
      title: "Self-check step missing",
      message: "This lab requires an explicit verification step before final output.",
      fix: "Add: 'Before final answer, verify against this checklist: ...'"
    });
  }

  const matchingBannedPhrases = config.banned_phrases.filter((phrase) => loweredPrompt.includes(phrase.toLowerCase()));
  for (const phrase of matchingBannedPhrases) {
    issues.push({
      code: "banned_phrase",
      severity: "error",
      title: "Unsafe or banned phrase detected",
      message: `The prompt contains banned phrase: "${phrase}".`,
      fix: "Remove jailbreak-like or policy-bypassing language and replace it with task-specific instructions."
    });
  }

  const hasRole = /\byou are\s+(an?|the)\b/i.test(trimmedPrompt) || /\bact as\b/i.test(trimmedPrompt);
  if (!hasRole) {
    issues.push({
      code: "role_missing",
      severity: "info",
      title: "Role framing could help",
      message: "No explicit audience/role framing detected.",
      fix: "Consider adding a role, e.g. 'You are a data analyst writing for a product manager.'"
    });
  }

  const ok = !issues.some((issue) => issue.severity === "error");

  return {
    ok,
    issues,
    stats: {
      length: trimmedPrompt.length,
      hasJson,
      hasBullets
    }
  };
}
