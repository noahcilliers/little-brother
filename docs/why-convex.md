# Why Convex

Convex is the whole backend for Little Brother. It stores the data, runs the server logic, takes the hook calls, pushes live updates, and runs background jobs. That means we don't run a separate database, API server, queue, websocket layer or cron box.

## What it does here

| Need in Little Brother | Convex feature | Where |
|---|---|---|
| Store agents, events, the intent graph, verdicts, inbox | Database tables with typed validators | [schema.ts](../packages/backend/convex/schema.ts) |
| `lb hook` posts every Claude Code hook event | HTTP actions (`POST /hook/:event`) | [http.ts](../packages/backend/convex/http.ts), [hooks/](../packages/backend/convex/hooks) |
| Find similar intents ("two agents doing the same thing") | Built-in vector index | [schema.ts](../packages/backend/convex/schema.ts), [classify/run.ts](../packages/backend/convex/classify/run.ts) |
| Keep embeddings and LLM calls out of the 150 ms PreToolUse path | Scheduler (`ctx.scheduler.runAfter`) runs classification in the background | [hooks/post.ts](../packages/backend/convex/hooks/post.ts), [hooks/prompt.ts](../packages/backend/convex/hooks/prompt.ts), [hooks/stop.ts](../packages/backend/convex/hooks/stop.ts), [classify/run.ts](../packages/backend/convex/classify/run.ts) |
| Push urgent inbox items into an idle session | Live subscriptions (`ConvexClient.onUpdate`) | [channel.ts](../apps/connector/src/mcp/channel.ts) |
| Dashboard updates without refreshing | Reactive `useQuery` in Next.js | [apps/web](../apps/web) |
| Mark agents inactive, expire claims, calibration | Cron jobs | [crons.ts](../packages/backend/convex/crons.ts) (the presence sweep runs every minute) |
| GitHub sign-in, member tokens | Convex Auth + JWT validation | [auth.config.ts](../packages/backend/convex/auth.config.ts), [tokenAuth.ts](../packages/backend/convex/tokenAuth.ts) |

## Why Convex

1. **Real-time is the product.** Little Brother tells agent B what agent A just did, while it's happening. Convex queries are live by default, so the dashboard and the channel forwarder get updates without any websocket or polling code. On Postgres we'd also need a pub/sub layer.
2. **Database, vector search, queue and cron in one place.** The classifier needs storage, similarity search, background work and scheduled sweeps. Elsewhere that's Postgres + pgvector + a job queue + a cron runner. Here it's one deployment.
3. **TypeScript end to end.** Schema, server functions, CLI and web share types, which fits the zod-contracts-in-`packages/core` design.
4. **Transactions keep the hot path fast and correct.** Mutations are atomic, so reading tier-0 rules and stored verdicts and writing the event happen in one consistent step. That helps keep PreToolUse under 150 ms.
5. **Hackathon fit.** The plan lists the Convex "Best Use" track ($5,000) as a core prize target. Zero ops and `convex dev` with hot reload also suit a 3-person build.

## Trade-offs

- **Lock-in.** It's a proprietary platform. The open-source backend can be self-hosted, but leaving would still mean a rewrite.
- **Limits on functions.** Queries and mutations must be deterministic and have time and size limits. Network calls, such as the Gemini embedder and judge, have to go in actions. That's why `classify/adapters/` sits behind actions and the scheduler.
- **No SQL.** Indexes are declared up front and queries are written in code. Ad-hoc analytics, like eval scoring, is clunkier than in Postgres.

See [PLAN.md](PLAN.md) for the full architecture.
