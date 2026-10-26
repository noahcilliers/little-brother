## Inspiration

Spinning up tens to hundreds of agents across our team and individual projects led to constant conflicts in the code being written. Agents picked incompatible approaches, built on names a teammate's session had just changed, and redid work another had already finished. Git only catches these at merge time, after the tokens are spent. We wanted every Claude Code session to have a **little brother** that shares decisions between sessions and flags the clash before the conflicting code gets written.

## What it does

Little Brother is a coordination layer for teams running many Claude Code sessions at once. It watches what every session is doing and catches conflicts between them before they turn into merge problems.

It detects and classifies two kinds of conflicts:

- **Code-level conflicts**, like two sessions creating the same file, editing the same function, or building on a name another session just changed.
- **Intent-level conflicts**, where two sessions make incompatible decisions, such as choosing different libraries or architectures for the same problem, or undoing something a teammate's session had already settled.

It also remembers failures. If one session tried an approach and watched the tests fail, the next session that starts down the same path gets told before it repeats it.

What happens next depends on how confident Little Brother is. When it's sure, it acts on its own. It tells the affected sessions what the others are doing and what was already decided, so each one corrects course and keeps going without anyone stepping in. When it's less sure, it flags the conflict for a human to review instead of guessing, so developers see only the clashes that need judgment. Whoever settles it on the dashboard, both agents hear the outcome and the board updates live for everyone.

Setup is one install command per laptop plus a Claude Code plugin. Each developer opts a session in with `/little-brother:join <code>`; nothing from other sessions on that laptop leaves the machine.

## How we built it

Convex is the backbone of Little Brother. It stores every session's activity, runs the conflict classifier, and pushes results back to the sessions and the dashboard in real time.

![Architecture: Claude Code sessions, the lb connector, Convex and the dashboard](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/01-architecture.png)

**On each laptop.** The Claude Code plugin wires 10 hook events (SessionStart, UserPromptSubmit, PreToolUse, PostToolUse, Stop and the rest) into `lb`, our connector CLI. `lb hook` turns each tool call into a normalized event: which files and symbols it touches, which line ranges, whether it's a plan, an edit or a test run. It parses TypeScript and Python, treats Bash redirects and heredocs as file writes, and snapshots the working tree around Bash commands so `sed -i` edits count too. Every hook fails open: any network or parse error exits 0 with no output, so our backend being down never blocks a developer. `lb` also runs a stdio MCP server that gives the agent tools (post_decision, post_knowledge, report_failure, inbox, ask and a few more) and keeps a live Convex subscription on that session's inbox, so an idle session still gets pushed a message when a teammate's work collides with it.

**In Convex.** Hooks arrive as HTTP actions. The PreToolUse path only runs deterministic rules and reads stored verdicts, so it can answer inside the same tool call with allow, warn or deny. We gave it a 150 ms budget. Everything slow runs afterwards in scheduled actions, queued through the Convex Workpool component and capped by the Rate Limiter component, so a burst of hooks from several sessions doesn't turn into a burst of model calls. Similar plans are found with Convex's vector index over Gemini embeddings. A cron sweeps agent presence every minute, Convex Auth handles GitHub sign-in, and the pair model itself lives in a Convex table, so shipping a retrained model is one `npx convex run` with no deploy.

![The hook path: rules in the same tool call, slow work afterwards, fail open](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/02-hook-path.png)

![Classifier cascade: rules, then our pair model, then the LLM judge](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/03-classifier-cascade.png)

**The classifier** is a cascade, cheapest first:

1. **Rules R1 to R12.** Same lines edited, the same new file created twice, a rename or deleted symbol that someone else still uses, a signature change against an existing call, an imported symbol changing, an exact repeat of a failed edit. R3 is a background `git merge-tree` against teammates' pushed branches.
2. **Our pair model.** A gradient-boosted tree model over 84 features of the two pieces of work, trained in Python with scikit-learn and exported to JSON so it runs inside Convex. It only answers when it is confident and the runner-up class isn't close; otherwise the pair goes on. It settles 27.6% of the pairs the rules leave open (633 of 2,291) at 95.6% accuracy, in about 0.07 ms per pair (scored out of fold on 4,166 labelled pairs from 408 repos and eval runs).

![Inside our pair model: 84 features, gradient-boosted trees, calibrated settle thresholds, stored in Convex](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/11-pair-model.png)

Each tree adds a little to every relation's score; the scores go through a softmax and a per-relation isotonic calibration so a probability means what it says:

$$
F\_r(x) = F\_{0,r} + \eta \sum\_{k=1}^{60} f\_{k,r}(x) \qquad \hat{p} = \operatorname{norm}\big(\operatorname{iso}\_r(\operatorname{softmax}(F(x))\_r)\big)
$$

The model only answers when the top relation clears its own threshold and the runner-up isn't close. Each threshold is the lowest confidence at which, out of fold, at least 90% of its settled conflicts (or 95% of its "nothing here" verdicts) were right, so π is 0.90 or 0.95:

$$
\text{settle} \iff \hat{p}\_{(1)} \ge \tau\_{\hat{y}} \quad \text{and} \quad \hat{p}\_{(1)} - \hat{p}\_{(2)} \ge 0.15 \qquad \tau\_r = \min t \ \text{ s.t. } \operatorname{Prec}\_r(t) \ge \pi\_r
$$


3. **An LLM judge** (Gemini by default, Claude as an option per room) for the hard ones. It takes around 7 s, so it always runs async, and it only sees pairs with a structural link or very similar wording.

   A pair only reaches the judge if something structural links the two pieces of work, or their embeddings are close enough; the bar is lower for a known failure and for two plans, where a contradiction often hides behind different wording:

$$
\text{judge}(a,b) \iff \text{link}(a,b) \quad \text{or} \quad \cos(e\_a, e\_b) \ge \theta \qquad \theta = 0.5 \text{, } 0.55 \text{ or } 0.8
$$


**Deciding what to do with a catch** is where most of our tuning went. We only interrupt an agent when the work we'd save is worth more than the interruption: confidence times the tokens it would redo has to beat about 2,500 tokens, roughly what a denial plus the turn spent reacting to it costs. Otherwise it's a hint. Correctness clashes (a change that will break the other branch, or contradicting decisions) are never downgraded. A denial carries a short card of what the other side built, so the agent doesn't burn tokens opening the other branch to find out. One clash between two tasks is one catch, however many steps re-trigger it.

$$
\text{deny} \iff c \cdot T\_{\text{redo}} > C\_{\text{deny}} \qquad C\_{\text{deny}} \approx 2500 \text{ tokens}
$$

What we count as saved is net of the cost of coordinating: 60% of the work a catch prevented (agents rarely redo all of it), minus the tokens the agent spent reading what the other side built:

$$
S = 0.6 \cdot T\_{\text{redo}} - T\_{\text{coord}}
$$


![Decision loop: confident catches go to the agents, unsure ones to a person on the dashboard](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/04-decision-loop.png)

**The dashboard** is Next.js on Vercel, with 45 live `useQuery` calls and React Flow for the board. Each person gets a lane, each catch draws a link between the two tasks, and anything waiting on a human can be decided right there, including from a phone.

**Evals.** We built a harness that runs headless Claude Code agents in pairs on the same repo with prompts that clash on purpose, once with Little Brother off and once on, then merges their branches and grades the result from git and the tests, never from an LLM. Graded runs stream into Convex over HTTP and show up live on the /benchmarks page. Besides our own planted suite we ran STALE-bench (interface changes in Django) and CooperBench. The repo has 497 vitest tests across core, backend, connector and evals.

On STALE-bench the headline metric is interference: of the runs that merge cleanly, the share where a test that passed on its own branch breaks after the merge.

$$
I = \frac{N\_{\text{breaks}}}{N\_{\text{clean}}}
$$


![Learning loop: catches, decisions and eval runs retrain the pair model stored in Convex](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/05-learning-loop.png)

## Challenges we ran into

- **"You won't be stopped again," and then it stopped them again.** Our deny-once rule downgraded the retry to a warning, but the hook still got the open catch row back and denied on its stored action. On STALE-bench the agent was told it wouldn't be stopped again, was stopped again, and gave up on its task. Now only rows that still enforce after the downgrade come back to the hook.

- **Headless agents read a denial as "stop the task."** After a denial, Haiku agents would stop and report back instead of retrying. A plain warning went the other way: agents ignored it and the merges broke again, and an early blocking version just made them wait for a human. We ended up rewriting every denial to say it is not a stop, how to place or rewrite the change, and to retry now. For interface clashes we now stop both sides once, each with its own fix: the caller writes against the new name, and the changer keeps the old one working where its task allows. Either fix alone still left STALE-bench merges broken.

- **Our own parser had blind spots that only real repos found.** STALE-bench caught two: we blanked out whole Python f-strings, so `f"{slugify(name)}.txt"` hid the call and a signature change to `slugify` was never matched to its caller. And two agents adding different functions to the same existing file were told the file was "already being created," a duplicate that wasn't one. Both are fixed, and the detection numbers below are from the rerun.

- **A 3 s hook timeout quietly dropped denials under load.** With a cold Node start plus a slow backend, PreToolUse sometimes crossed Claude Code's 3 s hook timeout, and Claude Code dropped our deny. We raised it to 8 s. The normal path didn't change; the limit only decides whether a slow verdict still counts.

- **The judge missed a business-rule clash because we cut the prompt at 500 characters.** One plan said "sale prices are final," another applied a SAVE10 promo to every item. The rule sat past the first sentence, so the judge called them compatible. We now send prompts up to 2,000 characters, give the judge the full plan, and added conflicting business rules to the judge prompt. The same pair now comes back as an intent contradiction.

## Accomplishments that we're proud of

- **Cheaper, cleaner runs.** In our off-vs-on pilot (Sonnet agents, larger tasks, 18 runs), cost per run dropped 26% ($0.35 to $0.26), new tokens dropped 17% (42.3k to 35.1k), merged success after the fix step went from 67% to 89%, and detection precision was 100%.
- **Catching clashes on a public benchmark.** On STALE-bench (Django interface changes, Haiku agents), letting agents message each other didn't help at all: 100% of merges broke a teammate's tests, the same as no coordination. After the fixes above, Little Brother caught 46 of 48 planted interface clashes with none mislabelled. Turning every catch into a merge that passes is the part we're still working on, and our eval report shows each rerun.
- **Detection after the fixes.** 18 of 18 clashes caught on the first STALE-bench rerun, up from 10 hits, 5 mislabels and 4 misses out of 19 before.
![Pair model vs LLM judge](https://raw.githubusercontent.com/noahcilliers/little-brother/main/docs/devpost/08-landing-classifier.png)

- **Our own model in front of the LLM.** The pair model settles 27.6% of open pairs (633 of 2,291) at 95.6% accuracy in about 0.07 ms, against about 7 s for the judge. It's trained on 4,166 labelled pairs from 408 repos and eval runs.
- **The judge pays for itself on our planted suite.** In our live detection benchmark (Sonnet agents, pointed prompts), switching Gemini on raised recall from 75% to 100% (36 of 36 planted clashes caught) and cut the median time to flag from 10.7 s to 3.4 s, at the cost of one false positive in 12 control runs (precision 97%).
- **It's a real product.** Rooms, invites, a waiting room, GitHub sign-in, a one-line installer, `lb update`, a live board you can open from your phone, and an eval board that fills in while a batch runs.

## What we learned

- **How you word a denial matters as much as when you send it.** The same catch either fixed the merge or made the agent quit, depending on whether the message said what to do next.
- **Interruptions cost tokens too.** Once we measured it, a denial plus the turn the agent spends reacting to it costs real tokens, so stopping an agent over a tiny duplicate made things worse. That's where the cost check came from.
- **Public benchmarks keep you honest.** Our own demo repo was saturated at 100% recall and stopped telling us anything. STALE-bench and CooperBench found the f-string bug, the deny-once bug and the duplicate mislabel in one night.
- **Count the runs you can't trust.** Rate limits killed some agents mid-run, and those runs looked like failures. We now mark any run whose stream shows an API error as voided and leave it out of every number. Gemini 429s during hook bursts are also why classifier runs go through a Workpool with a rate limit.
- **Small platform gotchas.** Convex module paths can't contain hyphens, which we learned when `persist-parts.ts` refused to deploy.

## What's next for Little Brother

- Close the gap between catching an interface clash and a merge that passes: on STALE-bench the caller still tends to keep the name its own branch has.
- Run the natural-language prompt variant of our planted suite (prompts that don't name files) with the judge on, and add harder cases and near-miss controls, since the pointed suite is saturated.
- Fix the one false positive we know about: an ordering dependency flagged against a session that was only reading a file.
- Fit the interruption cost and the redo factor from eval data instead of the constants we picked from the first before/after run.
- Keep growing the labelled set from real catches and decisions so the pair model can take more pairs off the judge, including the relations it still always hands over (duplicates and ordering).

---

## Built with

typescript, node.js, convex, convex-auth, convex-workpool, convex-rate-limiter, next.js, react, tailwind-css, react-flow, vercel, claude-code, model-context-protocol, anthropic-claude, gemini-api, gemini-embeddings, zod, vitest, biome, pnpm, python, scikit-learn, numpy, github-oauth, git

## Try it out

- https://little-brother-gules.vercel.app
- https://little-brother-gules.vercel.app/benchmarks
- https://github.com/noahcilliers/little-brother
