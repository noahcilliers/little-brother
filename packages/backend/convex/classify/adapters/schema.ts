import { JUDGE_JSON_SCHEMA } from "@lb/core";

/** Provider-safe copy: numeric bounds are not supported by every constrained decoder; zod enforces them. */
export function judgeSchema(): Record<string, unknown> {
  const { confidence: _c, ...rest } = JUDGE_JSON_SCHEMA.properties;
  return { ...JUDGE_JSON_SCHEMA, properties: { ...rest, confidence: { type: "number" } } };
}
