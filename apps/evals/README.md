# Evals

Live benchmark for Little Brother's conflict detection. Each case starts 2 headless Claude Code agents
on lb-demo-shop, each on its own branch and worktree, with prompts that clash on purpose. The real plugin
is loaded, and the eval measures what Little Brother flags.

## Running

```sh
# once: local backend in open mode
cd packages/backend && CONVEX_AGENT_MODE=anonymous npx convex dev
CONVEX_AGENT_MODE=anonymous npx convex env set LB_ALLOW_INVITE 1

# cheap smoke test, then the full suite
pnpm --filter @lb/evals eval --variant pointed --runs 1 --concurrency 4
pnpm --filter @lb/evals eval
pnpm --filter @lb/evals eval --compare apps/evals/results/<earlier-run>
```

`--list` prints the cases. `--help` lists every flag: model, runs, per-agent turn, budget and time limits,
concurrency.

Set `GEMINI_API_KEY` (or `CLASSIFIER_JUDGE=claude` + `ANTHROPIC_API_KEY`) on the deployment to include
the embedding and judge tiers. Without a key, only the rules run, and the report header says so.

## What a run does

1. Copies `demo/shop` into a new git repo under `/tmp/lb-evals/<tag>/`, with one branch and worktree per
   agent. It lives outside this checkout so agents don't load our CLAUDE.md.
2. Opens a fresh session in its own room (`evals:openRun`), so failure memory doesn't leak between runs.
3. Starts each agent with `claude -p` using a copy of `plugin/` wired to this checkout's connector build.
   An agent's `start` can wait for another agent's first edit or for it to finish.
4. Holds back `SessionEnd`: `claude -p` exits right after its task, and an offline agent drops out of
   every comparison. An interactive session would still be open. The harness closes everyone together.
5. Waits `--settle` seconds, reads the session's classifications (`evals:snapshot`), commits each
   worktree, merges all branches, and runs the case's checks.

## Scoring

Rows are grouped by agent pair.

| Outcome        | Meaning                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| hit            | A row on the expected pair, with the expected type (it counts even if the agent then avoided the clash) |
| mislabel       | A row on the expected pair, with another type                                                           |
| miss           | No row, and the checks show the clash happened                                                          |
| didn't happen  | No row, and no clash: excluded from recall                                                              |
| false positive | A row on any other pair, or any row in a control                                                        |

The headline numbers:
- **Recall** = (hit + mislabel) / (hit + mislabel + miss)
- **Strict recall** = hit / (hit + mislabel + miss)
- **Precision** = (hit + mislabel) / (hit + mislabel + false positives)

Each result also records the time from the later agent's prompt to the row, and whether the row came
before that agent's first edit.

## Layout

- `cases/`: the suite. Duplicate, conflict, dependency (semantic and ordering), stale, and controls.
  Every agent has a `pointed` prompt that names files and a `natural` one that doesn't.
- `src/`: the harness. `score.ts`, `aggregate.ts`, `stream.ts`, `triggers.ts` and `case.ts` are pure
  and unit tested. The rest is I/O.
- `results/` (gitignored): per run, `run.json` (agents, commands, Little Brother messages, checks, rows)
  and each agent's raw `stream.jsonl`. Per invocation, `summary.json`, `runs.json` and `report.md`.

## Writing a case

A case lists agents, the findings it expects (`agents`, `type`, the `evidence` check ids), and checks:
`mergeConflict`, `grep` (on an agent's branch or the merged one), `commandFails`, `touched`, `ran`,
`allOf`. Evidence decides whether a missing row is a miss or a clash that never happened, so pick checks
that only pass when the clash happened. `pnpm --filter @lb/evals test` validates every case.
