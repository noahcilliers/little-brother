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

### Streaming results to /benchmarks

The agents still run against the local backend; graded results can also stream to the public
deployment, where `/benchmarks` shows them live. Set a shared secret on that deployment once, then export
it with the deployment's site URL when you launch an eval:

```sh
cd packages/backend && npx convex env set --prod EVAL_INGEST_TOKEN <secret>
export LB_EVAL_PUBLISH_URL=https://<deployment>.convex.site EVAL_INGEST_TOKEN=<secret>
pnpm --filter @lb/evals eval --suite stale --arm both
```

The harness posts the batch plan, each run as soon as it is graded, and the finish (`live-publish.ts`).
Without both variables nothing is sent; a failing post is logged once and never stops the eval. Rows are
the ones `publish-results` would write for the same results dir, so publishing afterwards changes nothing.

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

## Hook overhead

Each agent runs with `LB_TIMING_FILE=<run>/<handle>.hooks.jsonl`, so every `lb hook` call appends one line:
total ms from process start to exit, ms per phase (boot, stdin, session, git, normalize, deliver, flush),
whether it was delivered or hit the watchdog, and how many characters of output reach the model. The
report's "Hook overhead" section pools PreToolUse calls across runs for p50/p95/max against the 150 ms
target, shows where the time goes by phase, and sets estimated tokens injected (chars / 4) against the
catches' `tokensSaved`. Node can't time its own exec and teardown, so the harness measures that once per
invocation and adds it to every call. `--compare` shows the change in all of these.

The same log works outside evals: set `LB_TIMING_FILE` in any shell or Claude session to time real use.

## Measured savings

`tokensSaved` is an estimate: a catch is credited with what the work it pointed at cost. To measure it,
run with `--arm both`. Every case and variant then also runs with Little Brother off: same prompts and
limits, but no plugin, hooks or MCP server, and no backend session. A run with the arm off fails if any
hook call or Little Brother message shows up.

Every run records its agents' summed API usage from the stream output. The report's "Measured savings"
section compares, per case and variant, mean new tokens (input + output + cache writes, the definition
`tokensSaved` uses) and cost with Little Brother off against on, with one standard error. It shows the
catch-based estimate next to that, and how often the planted clash happened in each arm. Runs aren't
paired, so it takes a few `--runs` per arm before a gap means more than noise; gaps under two standard
errors are marked. Detection and hook metrics read only runs with Little Brother on.

```sh
pnpm --filter @lb/evals eval --arm both --variant pointed --runs 3
```

## Layout

- `cases/`: the suite. Duplicate, conflict, dependency (semantic and ordering), stale, controls, and
  larger cases (`large.ts`) where the duplicated or failed work is a whole module with tests.
  Every agent has a `pointed` prompt that names files and a `natural` one that doesn't.
- `src/`: the harness. `score.ts`, `aggregate.ts`, `measured-savings.ts`, `stream.ts`, `triggers.ts` and
  `case.ts` are pure and unit tested. The rest is I/O.
- `results/` (gitignored): per run, `run.json` (agents, commands, Little Brother messages, checks, rows),
  each agent's raw `stream.jsonl` and its hook timing log `hooks.jsonl`. Runs with Little Brother off go in
  `runs/<case>-<variant>-off-<n>/`. Per invocation, `summary.json`, `runs.json` and `report.md`.

## Fix-up step, paired runs and the cost cap

After both agents finish, a third headless agent (Little Brother off, in both arms) gets every branch merged
into one tree, with conflict markers left in place, both tasks, and the case's success commands. Its
tokens, cost and wall time count toward the run; `finalSuccess` records whether the integrated tree passes:
no markers, every `success.run` command exits 0 (default: typecheck and the unit tests that pass on the
untouched shop), and every `success.intact` pattern is still there. `--no-fixup` skips it.

`--paired --seed n` queues each case, variant and repetition's off and on runs next to each other in a
seeded order, so they run side by side; the report then adds paired differences (off − on, ± one standard
error of the mean difference) for tokens, cache reads, dollars, wall time and final success.

Every finished run is appended to a spend ledger (`results/ledger.jsonl`, `--ledger`), shared by every
invocation; once Claude Code's estimated cost there reaches `--cap-usd` (default 60), runs not yet started
are skipped and listed. All invocations share one `LB_HOME` (`results/.lb-home`, or `$LB_EVAL_HOME`):
joining a handle replaces its token, so separate homes would log each other out.

The harness finds `claude` on PATH, else `$LB_EVAL_CLAUDE`, else the newest VS Code extension's bundled
binary. It reads the local backend through `anonymous:<name>` from `packages/backend/.convex/local`, since
`.env.local` may name a cloud deployment, and refuses any production deployment.

Savings estimates count each catch once (its `catchKey`, else the pair and verdict type), not each row.

## External suites

`--suite stale` runs [STALE-bench](https://github.com/illinoisdata/STALE-bench) Django pairs and `--suite
cooper` runs [CooperBench](https://github.com/cooperbench/CooperBench) feature pairs, each pair as two live
agents on worktrees at the task's base commit, with the same arms, pairing and cap. Clone the benchmark to
`~/.cache/little-brother/benchmarks/<name>` and the repos (django, click, jinja, dirty-equals) to
`~/.cache/little-brother/repos/`; Python venvs with each repo's dependencies are built under
`~/.cache/little-brother/venvs/`, and agents import the package from their own checkout via PYTHONPATH.
- **STALE-bench**: the real-derived tier (a helper's interface changes on one branch, a consumer reuses it
  on the other; we write task A concretely: rename, required keyword-only `strict`, or a result object),
  mined coupled pairs and controls. Agents see the PR title and body (Trac description when the body is
  only template), never the gold patch. Grading discards agent test edits, applies both PRs' gold tests in
  every condition and runs both PRs' labels: interference (Δblind) = tests that pass with the owning
  branch alone and fail merged.
- **CooperBench**: their dataset and hidden tests with our runner (theirs needs Modal or Docker plus
  Redis). Success = a clean merge and every feature's tests passing on it. Tests that already fail on the
  untouched base in our Python are deselected.

```sh
pnpm --filter @lb/evals eval --suite stale --list
pnpm --filter @lb/evals eval --suite stale --arm both --runs 2 --paired --max-turns 50 --timeout-min 20
pnpm --filter @lb/evals eval --suite cooper --cases pallets_click_task/2800/2+6 --arm both --runs 2
pnpm --filter @lb/evals site-summary --planted <dir>,<dir> --suites <dir>,<dir> --out docs/evals/<date>-summary.json
```

## Writing a case

A case lists agents, the findings it expects (`agents`, `type`, the `evidence` check ids), and checks:
`mergeConflict`, `grep` (on an agent's branch or the merged one), `commandFails`, `touched`, `ran`,
`allOf`. `grep` patterns are JavaScript regexes matched line by line (macOS `git grep -E` has no `\s`,
`\w` or `\b`). Evidence decides whether a missing row is a miss or a clash that never happened, so pick checks
that only pass when the clash happened. `pnpm --filter @lb/evals test` validates every case.
