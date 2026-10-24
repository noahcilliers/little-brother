# Little Brother

Coordination layer for independent Claude Code sessions. Full plan: [docs/PLAN.md](docs/PLAN.md).

## Layout

- `packages/core` — zod schemas, shared types, pure logic (classifier interfaces, tier-0 rules, digest rendering). No I/O.
- `packages/backend/convex` — Convex schema, queries, mutations, actions, HTTP routes, crons; `classify/` runs the cascade, `classify/adapters/` holds model providers.
- `apps/connector` — `lb` CLI: hook pipe, stdio MCP server, login/join, verify.
- `apps/web` — Next.js dashboard.
- `plugin/` — Claude Code plugin (hooks + MCP + skill) installed on each dev machine.

## Rules

- TypeScript strict. No `any`, no non-null `!` outside tests. Validate with zod at boundaries only (hook stdin, HTTP, MCP args, LLM output).
- Pure logic goes in `packages/core` with a unit test. Convex functions and CLI commands stay thin: parse → call core → persist.
- One responsibility per file; split before 200 lines. Named exports only.
- Comments explain *why*, never *what*. No commented-out code, no TODO without an owner (`TODO(ash):`).
- Add a dependency only if it's in the plan's stack table or replaces 50+ lines of our own code.
- Hooks must fail open: any network/parse error exits 0 with no output. Never block a developer because our backend is down.
- PreToolUse path stays under 150 ms: tier-0 rules and stored verdicts only. Embeddings and LLM calls run in scheduled Convex actions.
- Model providers sit behind the `Embedder` and `Judge` interfaces. Nothing outside `classify/adapters/` imports a provider SDK.
- UI uses design tokens from `apps/web/app/globals.css` and shadcn primitives. No hex colors in components.
- Names: files kebab-case, functions camelCase, Convex tables plural camelCase, node kinds lowercase singular.

## Commands

- `pnpm dev` — Convex dev + web + connector watch
- `pnpm test` — vitest across packages
- `pnpm check` — biome lint + format + tsc
