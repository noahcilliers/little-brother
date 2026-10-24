import { readFileSync } from "node:fs";
import { CASES } from "../../apps/evals/cases";
import type { EvalCase } from "../../apps/evals/src/case";
import type { Relation } from "../../packages/core/src/index";

// Raw material for the SYNTHETIC training set: who did what in the live eval cases and the demo story.

export type Unit = {
  source: string; // case id or "scenario"
  handle: string;
  prompts: string[];
  files: string[];
  symbols: string[];
};

export type Planted = { caseId: string; a: Unit; b: Unit; relation: Relation; control: boolean };

const FILE = /\b(?:[\w-]+\/)+[\w.-]+\.(?:ts|tsx|js|json)\b|\b[\w-]+\.config\.ts\b/g;
const SYMBOL = /\b([a-z][A-Za-z0-9]{3,})\(|interface\s+(\w+)|`(\w+)`|\b(require[A-Z]\w+|issueToken|sendMail)\b/g;
const NOT_SYMBOLS = new Set(["origin", "cors", "test", "name", "proxy", "displayName"]);

export function filesIn(text: string): string[] {
  return [...new Set(text.match(FILE) ?? [])];
}

export function symbolsIn(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(SYMBOL)) {
    const s = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (s && !NOT_SYMBOLS.has(s)) out.add(s);
  }
  return [...out];
}

/** Topic map in the spirit of lb-demo-shop's .littlebrother.json. */
export function topicOf(path: string): string | undefined {
  const map: [RegExp, string][] = [
    [/^src\/auth\//, "auth.session"],
    [/^src\/server\.ts$|vite\.config/, "api.cors"],
    [/^db\/schema\/users/, "db.users"],
    [/order/, "orders.model"],
    [/^src\/notify\//, "notify.mail"],
    [/^src\/catalog\//, "catalog.api"],
    [/^src\/checkout\//, "checkout.api"],
    [/^src\/payments\//, "payments.stripe"],
    [/vitest\.config|^test\//, "test.env"],
    [/^web\//, "storefront.ui"],
    [/^src\/contracts\/user/, "contracts.user"],
  ];
  return map.find(([re]) => re.test(path))?.[1];
}

function unitOf(c: EvalCase, handle: string): Unit {
  const spec = c.agents.find((a) => a.handle === handle);
  const prompts = spec ? [spec.prompt.pointed, spec.prompt.natural] : [];
  const pointed = spec?.prompt.pointed ?? "";
  return { source: c.id, handle, prompts, files: filesIn(pointed), symbols: symbolsIn(pointed) };
}

const TYPE_RELATION: Record<string, Relation> = {
  duplicate: "duplicate",
  conflict: "textual_conflict",
  stale: "repeats_failure",
};

/** Every planted clash (positive) and every control pair (negative) in the eval suite. */
export function plantedPairs(): Planted[] {
  return CASES.flatMap((c): Planted[] => {
    if (c.expect.length === 0) {
      const [a, b] = c.agents;
      return a && b ? [{ caseId: c.id, a: unitOf(c, a.handle), b: unitOf(c, b.handle), relation: "independent", control: true }] : [];
    }
    return c.expect.map((e) => ({
      caseId: c.id,
      a: unitOf(c, e.agents[0]),
      b: unitOf(c, e.agents[1]),
      relation: e.relation ?? TYPE_RELATION[e.type] ?? "duplicate",
      control: false,
    }));
  });
}

/** One unit per agent in the demo story (fixtures/scenario.jsonl): its prompts and the files it wrote. */
export function scenarioUnits(path: string): Unit[] {
  const by = new Map<string, Unit>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    const r = JSON.parse(line) as { as?: string; input?: Record<string, unknown> };
    const input = r.input ?? {};
    const handle = r.as ?? "?";
    const u = by.get(handle) ?? { source: "scenario", handle, prompts: [], files: [], symbols: [] };
    by.set(handle, u);
    if (input.hook_event_name === "UserPromptSubmit" && typeof input.prompt === "string") u.prompts.push(input.prompt);
    const tool = input.tool_input as { file_path?: unknown; content?: unknown; new_string?: unknown } | undefined;
    if (input.hook_event_name === "PreToolUse" && typeof tool?.file_path === "string") {
      const rel = tool.file_path.replace(/^\/tmp\/lb-demo\/\w+\//, "");
      if (!u.files.includes(rel)) u.files.push(rel);
      const body = `${String(tool.content ?? "")} ${String(tool.new_string ?? "")}`;
      for (const m of body.matchAll(/export (?:async )?(?:function|const|interface|type) (\w+)/g))
        if (m[1] && !u.symbols.includes(m[1])) u.symbols.push(m[1]);
    }
  }
  return [...by.values()].filter((u) => u.prompts.length > 0);
}
