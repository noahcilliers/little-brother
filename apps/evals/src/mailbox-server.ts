// A minimal MCP stdio server giving eval agents a shared mailbox: the `msg` arm, the published coordination
// baseline (CooperBench's cooperative setting) with no Little Brother. Runs under plain `node` (type stripping),
// so it imports only Node built-ins. Each agent gets its own process; they share MAILBOX_FILE (JSON lines).

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createInterface } from "node:readline";

type Message = { from: string; to: string; text: string; at: string };
type Request = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };

const FILE = process.env.MAILBOX_FILE ?? "";
const ME = process.env.MAILBOX_HANDLE ?? "agent";
let seen = 0;

const TOOLS = [
  {
    name: "send",
    description:
      "Send a message to your teammates (or one teammate by handle). Use it to say what you are changing that could affect them: files, function names, signatures, decisions.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "The message." },
        to: { type: "string", description: "A teammate's handle; omit for everyone." },
      },
      required: ["text"],
    },
  },
  {
    name: "read",
    description: "Read messages from teammates you haven't read yet.",
    inputSchema: { type: "object", properties: {} },
  },
];

function all(): Message[] {
  if (!FILE || !existsSync(FILE)) return [];
  return readFileSync(FILE, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as Message];
      } catch {
        return [];
      }
    });
}

function call(name: string, args: Record<string, unknown>): string {
  if (name === "send") {
    const text = typeof args.text === "string" ? args.text : "";
    const to = typeof args.to === "string" && args.to ? args.to : "all";
    if (!text) return "Nothing sent: text is empty.";
    const m: Message = { from: ME, to, text, at: new Date().toISOString() };
    appendFileSync(FILE, `${JSON.stringify(m)}\n`);
    return `Sent to ${to}.`;
  }
  if (name === "read") {
    const msgs = all();
    const fresh = msgs.slice(seen).filter((m) => m.from !== ME && (m.to === "all" || m.to === ME));
    seen = msgs.length;
    return fresh.length ? fresh.map((m) => `[${m.at}] ${m.from}: ${m.text}`).join("\n") : "No new messages.";
  }
  throw new Error(`unknown tool ${name}`);
}

function reply(id: Request["id"], result: unknown): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id: Request["id"], message: string): void {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code: -32601, message } })}\n`);
}

createInterface({ input: process.stdin }).on("line", (line) => {
  let req: Request;
  try {
    req = JSON.parse(line) as Request;
  } catch {
    return;
  }
  if (req.id === undefined) return;
  const p = req.params ?? {};
  if (req.method === "initialize")
    return reply(req.id, {
      protocolVersion: typeof p.protocolVersion === "string" ? p.protocolVersion : "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "mailbox", version: "1.0.0" },
    });
  if (req.method === "ping") return reply(req.id, {});
  if (req.method === "tools/list") return reply(req.id, { tools: TOOLS });
  if (req.method === "tools/call") {
    try {
      const args = (p.arguments ?? {}) as Record<string, unknown>;
      return reply(req.id, { content: [{ type: "text", text: call(String(p.name), args) }] });
    } catch (e) {
      return reply(req.id, { content: [{ type: "text", text: String(e) }], isError: true });
    }
  }
  fail(req.id, `method not found: ${req.method}`);
});
