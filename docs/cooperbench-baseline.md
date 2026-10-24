# CooperBench baseline

What Little Brother is measured against on CooperBench, and how to run the comparison fairly.

## Summary

- In the CooperBench paper, two agents building separate features in one repo pass **about half as
  often** as one agent building both. GPT-5 and Claude Sonnet 4.5 reach about 25% as a pair versus
  about 50% alone.
- Giving the agents a message channel **did not help**: 17.6% average success without messaging and
  17.1% with it. Little Brother has to beat that.
- The paper's numbers come from a different agent harness, older models and a more lenient scorer, so
  they're background. The real baseline is our own run of the same agents **without** Little Brother.
- **The feature pairs our shared repos use are poor at showing a gap.** On jinja-1621 every strong
  model passes them alone and as a pair. On click-2800 they fail even when one agent does both. The
  test needs pairs where one agent passes and a pair fails. That section lists them.

## The paper

"CooperBench: Why Coding Agents Cannot be Your Teammates Yet",
[arXiv 2601.13295](https://arxiv.org/abs/2601.13295) (v2, January 2026).

- **Benchmark:** 652 two-feature tasks across 12 libraries in 4 languages (Python, Go, Rust, TypeScript),
  from real open-source repos with expert-written tests.
- **Setup:** OpenHands v0.54. Each agent builds one feature on its own branch. Agents can message each
  other through a custom SQL-backed tool. A task passes only if **both** features' tests pass on the
  merged code.
- **Models:** GPT-5, Claude Sonnet 4.5, MiniMax M2, Qwen3-Coder-30B, Qwen3-30B.
- **Merging:** plain `git merge-file` first. If that conflicts or fails the tests, a "union" merge that
  keeps both sides. If that also fails, a small LLM merge model.

### Headline results

- Pairs average **30% lower** success than one agent doing both features (abstract).
- GPT-5 and Claude Sonnet 4.5 reach **about 25%** as a pair, **around 50% lower** than solo (§4).

Successes in the paper's difficulty-stratified table (Table 5, Appendix C):

| Model             | Solo successes | Pair successes | Pair keeps |
| ----------------- | -------------- | -------------- | ---------- |
| GPT-5             | 315            | 183            | 64%        |
| Claude Sonnet 4.5 | 307            | 168            | 60%        |
| MiniMax M2        | 236            | 91             | 46%        |
| Qwen3-Coder       | 141            | 87             | 63%        |
| Qwen3             | 41             | 30             | 68%        |
| **All**           | **1,039**      | **558**        | **59%**    |

### Messaging didn't help

Pair success with and without the message tool (Table 6, Appendix E, all 652 tasks):

| Model          | No messaging | With messaging | Change |
| -------------- | ------------ | -------------- | ------ |
| GPT-5          | 27.91%       | 27.90%         | −0.1   |
| Claude 4.5     | 27.30%       | 25.92%         | −1.4   |
| MiniMax-M2     | 14.88%       | 13.96%         | −0.9   |
| Qwen3-Coder    | 14.72%       | 13.34%         | −1.4   |
| Qwen3-Instruct | 3.37%        | 4.60%          | +1.2   |
| **Average**    | **17.64%**   | **17.14%**     | −0.5   |

The paper says the difference is not statistically significant. It names three failure modes:

- **Communication:** messages are vague, badly timed or wrong.
- **Commitment:** agents don't do what they said they would.
- **Expectations:** agents misjudge their teammate's plans.

Those are what Little Brother targets. It detects clashes from what the agents actually do, not from
what they say.

## Our three shared repos

The paper's per-pair results for these repos are in
`~/CooperBench/hackathon_examples/shared_*/scoring/past_results.json`, taken from the paper's published
trajectories (OpenHands, Nov 2025). Each feature pair ran once per model.

| Shared repo                                                              | Tests                                                     | agent1 / agent2 / agent3 = paper features |
| ------------------------------------------------------------------------ | --------------------------------------------------------- | ----------------------------------------- |
| [cooperbench-click-2800](https://github.com/noahcilliers/cooperbench-click-2800) | `tests/test_shell_completion.py`, `tests/test_context.py` | 1 / 7 / 3                                 |
| [cooperbench-jinja-1559](https://github.com/noahcilliers/cooperbench-jinja-1559) | `tests/test_ext.py`                                       | 1 / 4 / 10                                |
| [cooperbench-jinja-1621](https://github.com/noahcilliers/cooperbench-jinja-1621) | `tests/test_loader.py`                                    | 1 / 2 / 3                                 |

### Every pair in each task

"Pass" counts union and LLM-merge passes, as the paper does. Strict passes need a clean merge.

| Repo       | Pair pass rate           | Pair strict passes | Solo pass rate | Pair merge conflicts |
| ---------- | ------------------------ | ------------------ | -------------- | -------------------- |
| click-2800 | 13% (14/105)             | 13                 | 13% (11/84)    | 11                   |
| jinja-1559 | 38% (69/184)             | 63                 | 26% (50/194)   | 11                   |
| jinja-1621 | 46% (93/204)             | 81                 | 55% (123/225)  | 13                   |

By model, pair vs. solo:

| Model             | click-2800       | jinja-1559        | jinja-1621        |
| ----------------- | ---------------- | ----------------- | ----------------- |
| GPT-5             | 29% vs. –*       | 27% vs. 57%       | 71% vs. 78%       |
| Claude Sonnet 4.5 | 19% vs. 19%      | 76% vs. 60%       | 51% vs. 78%       |
| MiniMax M2        | 5% vs. 24%       | 25%† vs. 24%      | 71%† vs. 67%      |
| Qwen3-Coder-30B   | 14% vs. 10%      | 49% vs. 7%        | 38% vs. 38%       |
| Qwen3-30B         | 0% vs. 0%        | 0% vs. 2%         | 9% vs. 13%        |

\* No GPT-5 solo results on click-2800. † Only 4 (jinja-1559) or 24 (jinja-1621) pair runs.
The jinja solo GPT-5 numbers assume that unnamed solo files are GPT-5, as noted in the source file.

Three things stand out:

- **Pairs don't always do worse.** On jinja-1559, Claude passes 76% as a pair versus 60% alone.
- **Merge conflicts are rare:** 11–13 per repo. Most pair failures merge cleanly and then fail the
  tests. Little Brother has to catch features that are incompatible in meaning, not just edits to the
  same lines.
- **jinja-1621 shows the clearest gap:** Claude passes 78% alone versus 51% as a pair.

### The exact pairs our shared repos use

| Repo       | Pair (features) | Pair result                                                                  | Solo result                                                      |
| ---------- | --------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| click-2800 | 1 + 7           | all 5 fail (2 conflicts)                                                     | only Qwen3-Coder passes (no GPT-5 solo run)                      |
| click-2800 | 1 + 3           | only GPT-5 passes                                                            | only MiniMax passes (no GPT-5 solo run)                          |
| click-2800 | 7 + 3           | all 5 fail (2 conflicts)                                                     | all fail (no GPT-5 solo run)                                     |
| jinja-1559 | 1 + 4           | GPT-5 (union merge) and Qwen3-Coder pass                                     | GPT-5 and Claude pass                                            |
| jinja-1559 | 1 + 10          | only Claude passes                                                           | GPT-5, Claude and MiniMax pass                                   |
| jinja-1559 | 4 + 10          | Claude and Qwen3-Coder pass                                                  | all fail (no GPT-5 solo run)                                     |
| jinja-1621 | 1 + 2           | all but Qwen3 pass                                                           | all pass                                                         |
| jinja-1621 | 1 + 3           | all but Qwen3 pass                                                           | all but Qwen3 pass                                               |
| jinja-1621 | 2 + 3           | all but Qwen3 pass                                                           | all but Qwen3 pass                                               |

So as configured:

- **jinja-1621 (1/2/3) is a "do no harm" check.** Strong models pass with or without a partner, so
  Little Brother can't improve on it. It can only show that Little Brother doesn't get in the way.
- **click-2800 (1/7/3) is mostly too hard.** When one agent can't build both features, coordination
  won't rescue the pair.
- **jinja-1559 (1/4/10) is mixed** and too small to show anything on its own.

### Pairs where coordination is the problem

These pairs have at least one model that passed alone and failed as a pair. They're where Little
Brother could make a difference. Every feature has a prompt and hidden tests in
`hackathon_examples/<task>/prompts/all/` and `eval/all/`, against the same repo snapshot, so
`make_shared_repo.py` can build a shared repo for any of them.

| Repo       | Pair   | Passed alone, failed as a pair             |
| ---------- | ------ | ------------------------------------------ |
| jinja-1621 | 1 + 9  | Claude, GPT-5 (conflict), Qwen3-Coder      |
| jinja-1621 | 2 + 10 | Claude, MiniMax                            |
| jinja-1621 | 5 + 8  | Claude, GPT-5                              |
| jinja-1621 | 3 + 10 | Claude, GPT-5                              |
| jinja-1621 | 2 + 6  | Claude, Qwen3-Coder                        |
| jinja-1621 | 1 + 5  | Claude, Qwen3-Coder                        |
| jinja-1621 | 1 + 10 | GPT-5, Qwen3-Coder                         |
| jinja-1621 | 2 + 5  | GPT-5 (conflict), Qwen3                    |
| jinja-1559 | 6 + 10 | Claude, Qwen3-Coder, Qwen3                 |
| jinja-1559 | 5 + 10 | Claude                                     |
| jinja-1559 | 1 + 10 | GPT-5                                      |
| click-2800 | 2 + 6  | Claude, MiniMax                            |

Across the three tasks, 58 of 184 solo passes became pair failures: 37 in jinja-1621, 11 in jinja-1559
and 10 in click-2800. Each of these comes from a single run, so a pair can land here by luck. Confirm
the gap in our own solo and no-Little-Brother runs before relying on a pair.

## Caveats

- **Different harness and models.** The paper ran OpenHands with late-2025 models. We'll run Claude
  Code (and other agents through the cross-model connector) on current models, which will score
  differently whatever Little Brother does.
- **Our scorer is stricter.** `score.sh` needs the branches to merge cleanly. The paper also counted
  union-merge passes: 1, 6 and 12 of the pair passes above for click-2800, jinja-1559 and jinja-1621. When citing the paper,
  report both.
- **One run per pair per model.** The per-pair results above are single runs. Small differences are
  noise.
- **The GPT-5 solo labels are inferred.** The source file assumes solo results with no model in the
  file name are GPT-5.
- **The paper doesn't print its per-model coop and solo rates.** They're only in a figure. The text
  gives "about 25%" for pairs and "around 50% lower" than solo, and Table 5 gives counts, not rates.
- **Not comparable to our in-repo eval.** [eval-results-2026-10-24.md](eval-results-2026-10-24.md)
  measures whether Little Brother flags planted clashes in our demo shop. CooperBench measures whether
  the agents' merged code passes the tests.

## The comparison plan

Run three arms. Everything except the coordination setup stays the same.

| Arm               | Setup                                                                                     | What it tells us |
| ----------------- | ----------------------------------------------------------------------------------------- | ---------------- |
| **A. Solo**       | One agent gets both feature prompts and works on one branch                               | The ceiling: what the model can do without needing to coordinate |
| **B. Pair, no LB** | Two agents, one feature each, on their own branches, no Little Brother                   | The control: the coordination gap for our agents and models |
| **C. Pair + LB**  | Same as B, with the Little Brother plugin or cross-model connector on both agents, sharing one session | The treatment |

An optional **B′ (pair with a plain message channel)** mirrors the paper's setup and tests whether
Little Brother beats simple messaging.

### Keep the same across arms

- Agent harness and model. For cross-model runs, keep the same model assignment per agent slot.
- Feature prompts (`.task/agentN.md`), repo snapshot and branch layout.
- Turn, time and budget limits per agent.
- The scorer: `score.sh`, strict clean merge and every feature's hidden tests. Also record the union-merge
  result so the numbers can be put next to the paper's.
- Agents never see `eval/` or `scoring/`.

### Which pairs

1. **Main set:** pairs from the coordination-problem table above. Start with jinja-1621 1+9, 2+10, 5+8,
   3+10, 2+6 and 1+5, plus jinja-1559 6+10 and click-2800 2+6.
2. **"Do no harm" set:** jinja-1621 1+2, 1+3 and 2+3. All three arms should pass. A drop in arm C means
   Little Brother is getting in the way.
3. **Leave out** pairs that fail solo in arm A. Coordination can't fix a feature the model can't build.

### How many runs

Going from a 50% pass rate to 75% takes about **60 tries per arm** for a standard two-proportion test
(95% confidence, 80% power), for example 12 pairs × 5 runs. Running every pair in all three arms lets
us compare per pair (McNemar's test), which needs fewer runs. Fewer than about 30 tries per arm can only
show a very large effect.

### What to record

- **Main metric:** pass rate, meaning a clean merge plus both features' hidden tests.
- **Gap closed** = (C − B) / (A − B). This is the headline: how much of the coordination gap Little
  Brother recovers.
- Merge-conflict rate, and how often each feature passes on its own.
- Cost and wall time per arm.
- Little Brother's flags per run: kind, timing, whether they came before the second agent's first edit,
  and whether the agent changed course. Tag each failure with the paper's three modes (communication,
  commitment, expectations) so we can see which ones Little Brother fixes.

### Done looks like

A table of A, B and C pass rates with confidence intervals for the main set, the "gap closed" figure,
the "do no harm" result, and the paper's numbers alongside for context.

## Sources

- Paper: [arXiv 2601.13295](https://arxiv.org/abs/2601.13295), Tables 5 and 6, §2.2, §3, §4, §5.
- Per-pair paper results: `~/CooperBench/hackathon_examples/shared_{click_2800,jinja_1559,jinja_1621}/scoring/past_results.json`,
  from [CooperBench/trajectories](https://huggingface.co/datasets/CooperBench/trajectories).
- Feature-to-agent mapping: each shared repo's `scoring/tests/agentN_tests.patch` matches the task's
  `eval/all/featureN_tests.patch` byte for byte.
- Shared-repo setup and scoring rules: each repo's `HACKATHON.md` and
  `~/CooperBench/hackathon_examples/README.md`.
