import { McpArgs } from "@lb/core";
import { z } from "zod";

const MCP_TOOLS = Object.keys(McpArgs) as [keyof typeof McpArgs, ...(keyof typeof McpArgs)[]];

const base = {
  step: z.string().optional(),
  delayMs: z.number().nonnegative().optional(),
  as: z.string().min(1),
  cwd: z.string().optional(),
  /** Transcript snapshot for this line, relative to the scenario file; becomes the input's transcript_path. */
  transcript: z.string().optional(),
};
const HookLine = z.object({ ...base, input: z.object({ hook_event_name: z.string() }).passthrough() });
const McpLine = z.object({ ...base, mcp: z.enum(MCP_TOOLS), args: z.unknown().default({}) });
/** A recorded hook payload, or an MCP tool call made by that agent's session. */
export const ReplayLine = z.union([HookLine, McpLine]);
export type ReplayLine = z.infer<typeof ReplayLine>;

export type ParsedReplay = { lines: ReplayLine[]; errors: { line: number; message: string }[] };

export function parseReplay(text: string): ParsedReplay {
  const out: ParsedReplay = { lines: [], errors: [] };
  text.split("\n").forEach((raw, i) => {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("//")) return;
    try {
      const parsed = ReplayLine.safeParse(JSON.parse(trimmed));
      if (parsed.success) out.lines.push(parsed.data);
      else out.errors.push({ line: i + 1, message: parsed.error.issues.map((x) => x.message).join("; ") });
    } catch (e) {
      out.errors.push({ line: i + 1, message: e instanceof Error ? e.message : String(e) });
    }
  });
  return out;
}

const firstLine = (s: string, max = 140): string => {
  const lines = s.split("\n").map((x) => x.replace(/^\[little-brother\]\s*/, "").trim());
  const l = lines.find((x) => x.length > 0) ?? s;
  return l.length > max ? `${l.slice(0, max - 1)}…` : l;
};

/** One-line description of what the backend told the agent. */
export function describeOutput(output: unknown, delivered: boolean): string {
  if (!delivered) return "offline (queued in outbox)";
  if (output === null || typeof output !== "object") return "silent";
  const o = output as Record<string, unknown>;
  if (o.decision === "block") return `BLOCK STOP: ${firstLine(String(o.reason ?? ""))}`;
  const h = (o.hookSpecificOutput ?? {}) as Record<string, unknown>;
  if (h.permissionDecision === "deny") return `DENY: ${firstLine(String(h.permissionDecisionReason ?? ""))}`;
  if (typeof h.additionalContext === "string") return `CONTEXT: ${firstLine(h.additionalContext)}`;
  return JSON.stringify(output).slice(0, 140);
}
