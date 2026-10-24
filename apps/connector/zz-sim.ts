import { readFileSync, writeFileSync } from "node:fs";
import { hostname } from "node:os";
import { HookInput } from "@lb/core";
import { applyRecordedEdit } from "./src/commands/replay-apply";
import { parseReplay } from "./src/commands/replay-parse";
import { buildEnvelope } from "./src/hook/envelope";
import { repoInfo } from "./src/hook/git";
import { normalizeTool } from "./src/normalize";
import { loadTopicMap } from "./src/normalize/topic-map";

const ROOT = "/private/tmp/claude-507/lbsim/";
const { lines } = parseReplay(readFileSync(process.env.SIM_FILE ?? "../../fixtures/scenario.jsonl", "utf8"));
const out: unknown[] = [];
let now = 1_800_000_000_000;
for (const line of lines) {
  now += line.delayMs ?? 0;
  if ("mcp" in line) { out.push({ step: line.step, as: line.as, mcp: line.mcp, args: line.args, at: now }); continue; }
  const raw = JSON.parse(JSON.stringify(line.input).replaceAll("/tmp/lb-demo/", ROOT)) as Record<string, unknown>;
  const input = HookInput.parse(raw);
  applyRecordedEdit(raw, input.cwd);
  const repo = repoInfo(input.cwd);
  const n = input.hook_event_name;
  const normalized = n === "PreToolUse" || n === "PostToolUse" || n === "PostToolUseFailure"
    ? await normalizeTool({ tool: input.tool_name, input: input.tool_input, cwd: input.cwd, repoRoot: repo.root, phase: n === "PreToolUse" ? "pre" : "post", toolResponse: "tool_response" in input ? input.tool_response : undefined })
    : undefined;
  const env = buildEnvelope(input, { repo: repo.repo, branch: repo.branch, machine: hostname(), normalized, now });
  if (n === "SessionStart") env.topicMap = loadTopicMap(repo.root);
  out.push({ step: line.step, as: line.as, env });
}
writeFileSync("../../packages/backend/test/zz-envs.json", JSON.stringify(out));
console.log(out.length);
