// Dev only: replays the §8 demo story against a local backend through the same HTTP endpoints the connector uses.
// Run: pnpm --filter @lb/web seed   (env: LB_SITE_URL, LB_INVITE_CODE, LB_STEP_MS)

type SeedTouch = {
  path: string;
  op: "read" | "write" | "create" | "delete" | "signature_change";
  symbol?: string;
};
type Agent = { handle: string; branch: string; session: string; token: string };
type Hook = {
  tool?: string;
  files?: string[];
  touches?: SeedTouch[];
  references?: string[];
  prompt?: string;
  preview?: string;
  command?: string;
  exitCode?: number;
  outputTail?: string;
  tokens?: number;
};

const SITE = process.env.LB_SITE_URL ?? "http://127.0.0.1:3211";
const INVITE = process.env.LB_INVITE_CODE ?? "calhacks";
const STEP_MS = Number(process.env.LB_STEP_MS ?? 700);
const REPO = "lb-demo-shop";
const RUN = Date.now().toString(36);
let seq = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post(path: string, body: unknown, token?: string): Promise<unknown> {
  const res = await fetch(`${SITE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

async function join(handle: string, branch: string): Promise<Agent> {
  const out = (await post("/join", { invite: INVITE, handle, name: handle })) as { token: string };
  return { handle, branch, session: `${handle}-${RUN}`, token: out.token };
}

async function hook(a: Agent, name: string, h: Hook = {}) {
  seq += 1;
  const files = h.files ?? h.touches?.map((t) => t.path) ?? [];
  const envelope = {
    v: 1,
    eventKey: `seed|${a.session}|${name}|${seq}`,
    hook: name,
    session: {
      claudeSessionId: a.session,
      repo: REPO,
      branch: a.branch,
      machine: `${a.handle}-mbp`,
      cwd: `/Users/${a.handle}/${REPO}`,
    },
    tool: h.tool,
    files,
    touches: h.touches ?? files.map((path) => ({ path, op: "write" })),
    references: h.references ?? [],
    prompt: h.prompt,
    preview: h.preview,
    command: h.command,
    exitCode: h.exitCode,
    outputTail: h.outputTail,
    tokens: h.tokens,
    at: Date.now(),
  };
  const res = (await post(`/hook/${name}`, envelope, a.token)) as { output: unknown };
  const shown = res.output ? ` → ${JSON.stringify(res.output).slice(0, 160)}` : "";
  console.log(`${a.handle.padEnd(7)} ${name.padEnd(18)} ${h.tool ?? ""} ${files.join(",")}${shown}`);
  await sleep(STEP_MS);
}

async function mcp(a: Agent, tool: string, args: unknown) {
  const res = await post(`/mcp/${tool}`, { claudeSessionId: a.session, args }, a.token);
  console.log(`${a.handle.padEnd(7)} mcp ${tool} → ${JSON.stringify(res).slice(0, 120)}`);
  await sleep(STEP_MS);
}

async function main() {
  const noah = await join("noah", "noah/auth");
  const joshua = await join("joshua", "joshua/checkout");
  const ash = await join("ash", "ash/frontend");
  for (const a of [noah, joshua, ash]) await hook(a, "SessionStart");

  // Setup and the failed CORS trajectory that later powers the stale catch.
  await hook(noah, "UserPromptSubmit", {
    prompt: "Let the storefront call the API: add CORS to the Express server",
    files: ["src/server.ts"],
  });
  await hook(noah, "PreToolUse", {
    tool: "Edit",
    touches: [{ path: "src/server.ts", op: "write", symbol: "src/server.ts::app" }],
    preview: "+ app.use(cors({ origin: '*', credentials: true }))",
  });
  await hook(noah, "PostToolUse", { tool: "Edit", files: ["src/server.ts"] });
  await hook(noah, "PreToolUse", { tool: "Bash", command: "pnpm test:e2e", files: [] });
  await hook(noah, "PostToolUseFailure", {
    tool: "Bash",
    command: "pnpm test:e2e",
    exitCode: 1,
    outputTail: "Access-Control-Allow-Origin '*' cannot be used with credentials; browser rejected request",
    tokens: 18400,
  });
  await mcp(noah, "report_failure", {
    tried: "cors({ origin: '*', credentials: true }) in src/server.ts",
    why: "browsers reject wildcard origin with credentials",
    worked: "Vite /api proxy in web/vite.config.ts",
  });
  await hook(noah, "PreToolUse", {
    tool: "Edit",
    touches: [{ path: "web/vite.config.ts", op: "write" }],
    preview: "+ server: { proxy: { '/api': 'http://localhost:3001' } }",
  });
  await hook(noah, "PostToolUse", { tool: "Edit", files: ["web/vite.config.ts"] });
  await hook(noah, "Stop", {
    preview: "CORS wildcard+credentials failed; Vite /api proxy works.",
    tokens: 41200,
  });

  await hook(joshua, "UserPromptSubmit", {
    prompt: "Build the checkout backend: cart, order and payment endpoints",
    files: ["src/checkout/handler.ts"],
  });
  await hook(ash, "UserPromptSubmit", {
    prompt: "Build the product grid and cart drawer in the storefront",
    files: ["web/src/ProductGrid.tsx"],
  });

  // Duplicate: Noah owns the users table; Joshua's agent tries to create its own.
  await hook(noah, "UserPromptSubmit", {
    prompt: "Create the users table and the shared User contract",
    files: ["db/schema/users.ts", "src/contracts/user.ts"],
  });
  await hook(noah, "PreToolUse", {
    tool: "Write",
    touches: [{ path: "db/schema/users.ts", op: "create", symbol: "db/schema/users.ts::users" }],
    preview: "export const users = pgTable('users', { id, email, role })",
  });
  await hook(noah, "PostToolUse", { tool: "Write", files: ["db/schema/users.ts"] });
  await hook(joshua, "PreToolUse", {
    tool: "Write",
    touches: [{ path: "db/schema/users.ts", op: "create", symbol: "db/schema/users.ts::users" }],
    preview: "export const users = pgTable('users', { id, email })",
  });
  await hook(joshua, "PreToolUse", {
    tool: "Edit",
    touches: [
      { path: "src/checkout/handler.ts", op: "write", symbol: "src/checkout/handler.ts::createOrder" },
    ],
    references: ["src/contracts/user.ts::User"],
    preview: "+ const userId = req.session.userId",
  });
  await hook(joshua, "PostToolUse", { tool: "Edit", files: ["src/checkout/handler.ts"] });

  // Stale: Ash's agent sets out to repeat the CORS approach that already failed.
  await hook(ash, "UserPromptSubmit", {
    prompt: "Add CORS middleware to the API so the storefront can fetch products",
    files: ["src/server.ts"],
  });
  await hook(ash, "PreToolUse", {
    tool: "Edit",
    touches: [{ path: "src/server.ts", op: "write", symbol: "src/server.ts::app" }],
    preview: "+ app.use(cors({ origin: '*', credentials: true }))",
  });

  // Conflict: Noah switches auth to JWT while Joshua's checkout reads the cookie session.
  await hook(noah, "UserPromptSubmit", {
    prompt: "Switch auth from cookie sessions to JWT bearer tokens",
    files: ["src/auth/session.ts"],
  });
  await hook(noah, "PreToolUse", {
    tool: "Edit",
    touches: [
      { path: "src/auth/session.ts", op: "signature_change", symbol: "src/auth/session.ts::requireUser" },
    ],
    preview: "- req.session.userId\n+ verifyJwt(req.headers.authorization)",
  });
  await hook(noah, "PostToolUse", { tool: "Edit", files: ["src/auth/session.ts"] });
  await hook(joshua, "PreToolUse", {
    tool: "Edit",
    touches: [
      { path: "src/checkout/handler.ts", op: "write", symbol: "src/checkout/handler.ts::createOrder" },
    ],
    references: ["src/auth/session.ts::requireUser"],
    preview: "+ if (!req.session.userId) return res.status(401)",
  });
  await hook(joshua, "PostToolUse", { tool: "Edit", files: ["src/checkout/handler.ts"] });

  console.log("\nseeded. open http://localhost:3000");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
