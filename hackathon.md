# Hackathon log

- **Project:** Little Brother
- **Event:** Cal Hacks 13.0
- **What it does:** Coordinates teammates' parallel Claude Code sessions on one repo, warning agents before they duplicate work, clash on a decision, or retry an approach that already failed.
- **Live app:** https://little-brother-gules.vercel.app
- **Repo:** https://github.com/noahcilliers/little-brother
- **Frontend:** Vercel
- **Convex deployment:** https://fantastic-meerkat-18.convex.cloud
- **Components:** @convex-dev/workpool, @convex-dev/rate-limiter
- **Convex features:** schema, indexes, queries, mutations, actions, HTTP actions, crons, scheduled functions, vector search, realtime useQuery, paginated queries
- **Auth:** Convex Auth (GitHub)
- **AI models:** gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-embedding-001, claude-opus-5-5
- **Started:** 2026-10-24T05:42:00Z
- **Last updated:** 2026-10-25T10:41:00Z

## How we use Convex

- **Hook ingest:** every Claude Code prompt, edit and command posts to HTTP actions (`/hook/`, `/mcp/`, `/join`) in `packages/backend/convex/http.ts`.
- **Classifier cascade:** runs in actions queued on the Workpool component and capped by the Rate Limiter component (`convex/convex.config.ts`, `convex/classify/pool.ts`, `convex/classify/budget.ts`). Similar work is found with vector search on `nodes.by_embedding` (`convex/schema.ts`, `convex/classify/run.ts`).
- **Live board and decisions:** the session board, toasts and the decision modal are `useQuery` subscriptions. A click is a mutation that tells both agents (`apps/web/components/board/board.tsx`, `convex/resolve.ts`).
- **Agent presence:** a cron sweeps stale agents every minute (`convex/crons.ts`).
- **Live benchmarks:** the eval harness streams runs into Convex over HTTP (`convex/httpEvals.ts`, `convex/schemaEvals.ts`), and `/benchmarks` renders them live (`apps/web/components/benchmarks/benchmarks-live.tsx`).
- **Sign-in and rooms:** Convex Auth with GitHub (`convex/auth.ts`). Rooms, members and per-room classifier settings are queries and mutations (`convex/rooms.ts`, `convex/roomAdmin.ts`).

Screens that update live without a refresh: the session board, classifier log, room logs, laptops, waiting room, room settings and /benchmarks.

## Log

- 10-24 `dcd80f7` Convex backend: schema, HTTP hook ingest, classifier cascade, crons, auth (`convex/schema.ts`, `convex/http.ts`, `convex/classify/run.ts`)
- 10-24 `beb6434` Live session board (`apps/web/components/board/board.tsx`)
- 10-24 `0e3084f` Rooms and opt-in sessions (`convex/rooms.ts`, `convex/sessions.ts`)
- 10-24 `ea02501` Classifier log per session (`convex/dashboardQueries/log.ts`)
- 10-24 `7100dd9` Toasts for catches and decisions (`apps/web/lib/use-catch-toasts.ts`)
- 10-24 `d769803` Live eval harness with headless Claude agents (`apps/evals/src/run-case.ts`)
- 10-24 `04ca362` Workpool queue and Rate Limiter cap on judge calls (`convex/classify/pool.ts`, `convex/classify/budget.ts`)
- 10-24 `0f186e5` Per-room classifier choice (`convex/roomAdmin.ts`, `classifier-choice.tsx`)
- 10-24 `1c62268` Conflicts settled on the dashboard (`convex/resolve.ts`, `convex/settle.ts`)
- 10-24 `60721a8` Eval results published to Convex (`convex/evalBoard.ts`, `convex/evalLanding.ts`)
- 10-24 `8fe1dff` Evals stream live over HTTP to /benchmarks (`convex/httpEvals.ts`, `convex/evalLive.ts`)
- 10-25 `e04b1f5` Contradicting plans become dashboard decisions (`convex/dashboardQueries/decisions.ts`)
- 10-25 `20dca34` Local-only demo sign-in for recordings (`convex/demoSignIn.ts`)
