insert into public.pg_courses (id, title, level)
values ('11111111-1111-1111-1111-111111111111', 'Prompt Fundamentals', 'beginner')
on conflict (id) do nothing;

insert into public.pg_lessons (course_id, title, content_md, sort_order)
values
  ('11111111-1111-1111-1111-111111111111', 'Lesson 1: Prompt Intent', '# Placeholder\nDefine clear intent and audience for your prompt.', 1),
  ('11111111-1111-1111-1111-111111111111', 'Lesson 2: Constraints', '# Placeholder\nAdd hard constraints such as length, format, and tone.', 2),
  ('11111111-1111-1111-1111-111111111111', 'Lesson 3: Structured Outputs', '# Placeholder\nAsk for machine-readable outputs with explicit fields.', 3),
  ('11111111-1111-1111-1111-111111111111', 'Lesson 4: Few-shot Guidance', '# Placeholder\nProvide examples to anchor style and quality.', 4),
  ('11111111-1111-1111-1111-111111111111', 'Lesson 5: Self-check', '# Placeholder\nInstruct the model to verify before finalizing.', 5);

insert into public.pg_labs (id, title, difficulty, scenario_json, rubric_json)
values
  (
    '22222222-2222-2222-2222-222222222221',
    'Lab 1: Clarity & Goal',
    'easy',
    '{"context":"You are drafting a prompt for a support assistant.","goal":"Get a concise and actionable answer.","must_include":["role","goal","audience"]}'::jsonb,
    '{"criteria":{"clarity":40,"goal_specificity":40,"brevity":20}}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Lab 2: Constraints',
    'easy',
    '{"context":"Generate release notes.","goal":"Produce notes under strict constraints.","must_include":["word_limit","style","disallowed_content"]}'::jsonb,
    '{"criteria":{"constraint_completeness":45,"constraint_enforcement":35,"readability":20}}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    'Lab 3: Structured Output (JSON)',
    'medium',
    '{"context":"Extract requirements from a paragraph.","goal":"Return strict JSON output.","must_include":["schema","field_types","fallback"]}'::jsonb,
    '{"criteria":{"json_validity":50,"schema_alignment":30,"error_handling":20}}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    'Lab 4: Few-shot Example',
    'medium',
    '{"context":"Classify customer messages.","goal":"Use examples to improve consistency.","must_include":["positive_example","negative_example","edge_case"]}'::jsonb,
    '{"criteria":{"example_quality":40,"generalization":35,"instruction_cohesion":25}}'::jsonb
  ),
  (
    '22222222-2222-2222-2222-222222222225',
    'Lab 5: Self-check Checklist',
    'hard',
    '{"context":"Draft a high-stakes policy response.","goal":"Ensure quality before final answer.","must_include":["checklist","verification_step","confidence_note"]}'::jsonb,
    '{"criteria":{"checklist_coverage":40,"self_verification":40,"risk_awareness":20}}'::jsonb
  )
on conflict (id) do nothing;
