# Conflict Classifier — Specification

**Status:** Draft v0.1 · **Owner:** little-brother · **Last updated:** 2026-10-23

## 1. Purpose

When several coding agents work on one codebase at the same time, their work can collide. The conflict classifier takes a **new event** (an agent's declared plan or an actual code change) and decides how it relates to each **existing activity** in the system. It then recommends what the system should do about it.

It answers: _"Given what everyone else is currently doing, is this new piece of work safe to proceed, and if not, why and with whom?"_

### Non-goals (v0)

- Resolving conflicts automatically (it only detects and recommends).
- Judging code quality or correctness of a single change on its own.
- Comparing against the full historical archive. Only active and recent work is in scope.

---

## 2. Pipeline at a glance

```
new event
   │
   ▼
1. Normalize        → structured event (agent, intent, files, symbols, op, diff)
2. Find candidates  → top-k related active events (not the whole history)
3. Exact checks     → line overlap, same symbol written twice, changed signature still in use
4. Pair model       → label + confidence for each (new, candidate) pair
5. (Optional) LLM   → only for low-confidence or high-severity pairs
   │
   ▼
6. Decide & emit    → [{other_event, relation, confidence, evidence, suggested_action}]
   │
   ▼
7. Log              → every judgment stored, later joined with real outcomes
```

Each stage can **settle** a pair early. A pair settled by step 3 never reaches step 4. A confident step-4 verdict never reaches step 5. This keeps the common case cheap.

---

## 3. What the classifier has to know

The classifier is only as good as the context it can see. These are its knowledge requirements, grouped by source.

### 3.1 About the new event

| Field                                        | Why it's needed                                                                      | Required?                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------- |
| `agent_id`, `task_id`                        | Don't flag an agent against itself; group work by task                               | Yes                          |
| `kind` (`intent` / `edit`)                   | Intents are classified to _prevent_ conflicts, edits to _detect_ them                | Yes                          |
| `intent` (natural language)                  | Duplicate and contradiction detection                                                | Yes                          |
| `touches[]`: path, symbol, op, line range    | Overlap and rule checks                                                              | Yes (path and op at minimum) |
| `references[]`: symbols used but not changed | Semantic conflicts (someone changes what you depend on)                              | Strongly recommended         |
| `diff`                                       | Precise line overlap; lets the model see what actually changed                       | For `edit` events            |
| `branch`, `base_rev`                         | Line numbers only mean something relative to a revision; needed for merge simulation | For `edit` events            |
| `timestamp`, `status`                        | Windowing and re-classification                                                      | Yes                          |

### 3.2 About the codebase

| Knowledge                                                             | Used in                                                                           | Source                                  |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------- |
| **Symbol index**: which symbols exist, where they live                | Normalize (resolve paths and lines to symbols)                                    | tree-sitter / LSP, refreshed per commit |
| **Reference / call graph**: who calls or imports what                 | Candidate retrieval, semantic-conflict rules                                      | static analysis, refreshed per commit   |
| **Public-API surface**: which symbols are exported or externally used | Severity of signature changes                                                     | static analysis + config                |
| **Generated / lock / vendored files**                                 | Excluded or down-weighted (e.g. `package-lock.json` churn is not a real conflict) | config                                  |
| **Hot files** that everyone edits (routers, registries, configs)      | Avoid flagging every touch as a conflict                                          | config + learned from history           |

### 3.3 About the rest of the system

| Knowledge                                                                    | Used in                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| **Active event set**: all events with `status=active` inside the time window | Candidate retrieval                                 |
| **Agent → branch / worktree mapping**                                        | Merge simulation                                    |
| **Task relationships** (parent/child tasks, declared dependencies)           | Separating expected overlap from accidental overlap |
| **Prior judgments for the same pair**                                        | Avoid re-alerting; detect escalation                |

### 3.4 About past outcomes (feedback)

| Knowledge                                                                       | Used in                                                  |
| ------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Logged judgments joined with outcomes (merge failed, CI failed, human overrode) | Calibrating thresholds; training data for the pair model |
| Per-relation precision so far                                                   | Deciding which relations can auto-block vs only warn     |

### 3.5 Policy configuration

- Time window for "active" events (default: until `done` + 30 min).
- `top_k` candidates (default 10).
- Confidence thresholds per relation → action (see §6).
- Escalation band: which (relation, confidence) combinations go to the LLM.
- Budget limits: max LLM calls per event and per minute.

---

## 4. Data contracts

### 4.1 Input: Event

```yaml
id: "ev_7f3a"
agent_id: "agent-billing"
task_id: "T-142"
kind: intent | edit
intent: "Add currency parameter to pay()"
touches:
  - path: "billing/client.py"
    symbol: "billing.client.pay"
    op: read | write | create | delete | rename | signature_change
    lines: [40, 72] # inclusive, relative to base_rev; optional
    new_path: null # for renames
references: ["billing.models.Invoice"]
branch: "agent-billing/T-142"
base_rev: "a1b2c3d"
diff: "<unified diff>" # edit events only
status: active | done | abandoned
timestamp: "2026-10-23T22:10:00Z"
```

### 4.2 Relation labels

| Relation               | Meaning                             | Example                                                                             | Symmetric? |
| ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| `independent`          | No meaningful interaction           | Docs edit vs DB migration                                                           | Yes        |
| `overlap_compatible`   | Same area, no problem               | Two agents add separate functions to `utils.py`                                     | Yes        |
| `duplicate`            | Same work done twice                | Both agents "add retry to HTTP client"                                              | Yes        |
| `textual_conflict`     | Git cannot merge them               | Both edit lines 40–72 of `client.py`                                                | Yes        |
| `semantic_conflict`    | Merges cleanly but breaks behaviour | A changes `pay(amount)` → `pay(amount, currency)`; B adds new `pay(amount)` callers | **No**     |
| `intent_contradiction` | Goals pull in opposite directions   | A removes legacy auth; B extends legacy auth                                        | Yes        |
| `ordering_dependency`  | One must land before the other      | B uses `Invoice.currency`, which A is creating                                      | **No**     |

Asymmetric relations carry a `direction`: `new_needs_other`, `other_needs_new`, or `none`.

### 4.3 Actions

| Action      | Meaning                                                     |
| ----------- | ----------------------------------------------------------- |
| `ignore`    | No signal surfaced                                          |
| `warn`      | Notify both agents (and optionally a human); work continues |
| `serialize` | One agent waits or rebases after the other lands            |
| `block`     | Stop the new work until a human or orchestrator decides     |

### 4.4 Output: Judgment (one per candidate pair)

```yaml
other_event_id: "ev_19c0"
relation: semantic_conflict
direction: none
confidence: 0.88
evidence:
  - "ev_7f3a changes signature of billing.client.pay"
  - "ev_19c0 adds 3 call sites of billing.client.pay (checkout/flow.py L12, L88, L140)"
suggested_action: block
source: rule | pair_model | llm | fallback
retrieval_score: 0.93
model: null # model id when source = pair_model / llm
latency_ms: 4
```
The overall result for an event is the list of judgments plus a `worst_action` rollup.

---

## 5. Step-by-step process

Each step lists: **goal**, **inputs**, **what it needs to know**, **process**, **outputs**, **failure handling**, and a **latency budget**.

### Step 1 — Normalize

**Goal:** Turn whatever the agent emitted into a complete, consistent `Event`.

**Inputs:** Raw agent message (plan text, tool calls, file writes, diff).
**Needs to know:** Symbol index for the event's `base_rev`; path conventions; generated-file list.

**Process:**
1. Validate required fields (`agent_id`, `kind`, `intent`, at least one touch or a diff).
2. Canonicalize paths (repo-relative, resolve `./`, follow renames known in the index).
3. **From a diff:** parse hunks → `(path, lines)` touches. Map line ranges to enclosing symbols with the symbol index. Derive the op:
   - new file / new symbol → `create`
   - removed file / symbol → `delete`
   - parameter list or return type changed on an exported symbol → `signature_change`
   - otherwise → `write`
4. **From an intent only:** extract planned paths and symbols from the plan text and tool-call arguments. Mark them `confidence: low` because plans are often wrong about scope.
5. Fill `references` from imports and calls inside the touched code (static analysis on the changed region).
6. Drop or tag touches on generated, lock, or vendored files.
7. If this event updates an earlier one (same `agent_id` + `task_id`, intent → edit), link it via `supersedes` so later steps re-classify instead of duplicating.

**Outputs:** Normalized `Event`.
**Failure handling:** If symbol mapping fails, keep the file-level touch and continue (degrades precision, not recall). If required fields are missing, reject with a reason; don't guess.
**Latency budget:** < 50 ms without a diff; < 300 ms with diff parsing.

---

### Step 2 — Find candidates

**Goal:** Pick the small set of existing events worth comparing against, so later steps never scan everything.

**Inputs:** Normalized new event.
**Needs to know:** Active event set; inverted index of `path → events` and `symbol → events`; reference graph; intent embeddings (or lexical vectors) of active events.

**Process:** Gather candidates from several independent signals, merge them, and score:

| Signal                                                                | Finds                                            | Score weight (start) |
| --------------------------------------------------------------------- | ------------------------------------------------ | -------------------- |
| Same path mutated by both                                             | Textual conflicts, overlaps                      | 1.0                  |
| Same symbol touched by both                                           | Textual / semantic conflicts                     | 1.0                  |
| New event mutates a symbol the other _references_ (or vice versa)     | Semantic conflicts, ordering                     | 0.9                  |
| 1-hop reference-graph neighbours (callers/callees of touched symbols) | Semantic conflicts without shared files          | 0.6                  |
| Intent similarity above threshold                                     | Duplicates, contradictions                       | 0.8 × similarity     |
| Same task tree (parent/child task)                                    | Expected overlap (helps _lower_ false positives) | annotate only        |

Rules:
- Exclude events from the same `agent_id` (an agent doesn't conflict with itself) unless configured otherwise.
- Exclude `done`/`abandoned` events outside the window.
- Score = max signal weight + a small bonus per additional signal. Keep the **top-k** (default 10), plus **any** candidate with a path or symbol overlap regardless of k (never drop a likely textual conflict).
- Record _why_ each candidate was retrieved; this becomes evidence later.

**Outputs:** `[(candidate_event, retrieval_score, reasons[])]`.
**Failure handling:** If the embedding service is down, fall back to lexical similarity; structural signals still work.
**Latency budget:** < 50 ms for ~100 active events.

**Key note:** Intent similarity alone can't tell "add X" from "remove X". It only _retrieves_; later steps decide.

---

### Step 3 — Exact checks

**Goal:** Settle every pair that a deterministic rule can decide, for free and with high precision.

**Inputs:** (new event, candidate) pairs.
**Needs to know:** Both events' touches, references and diffs; reference graph; public-API list; optionally both branches for merge simulation.

**Rules (initial set):**

| #   | Condition                                                                | Relation                              | Confidence | Settles pair?                        |
| --- | ------------------------------------------------------------------------ | ------------------------------------- | ---------- | ------------------------------------ |
| R1  | Both mutate the same path with overlapping line ranges (same `base_rev`) | `textual_conflict`                    | 0.95       | Yes                                  |
| R2  | Both `create` the same path or symbol                                    | `textual_conflict`                    | 0.95       | Yes                                  |
| R3  | `git merge-tree` dry run between the two branches reports conflicts      | `textual_conflict`                    | 0.99       | Yes                                  |
| R4  | One `delete`s/`rename`s a path or symbol the other writes or references  | `semantic_conflict`                   | 0.9        | Yes                                  |
| R5  | One `signature_change`s a symbol the other references or calls           | `semantic_conflict`                   | 0.85       | Yes                                  |
| R6  | One `create`s a symbol the other references                              | `ordering_dependency` (direction set) | 0.8        | Yes                                  |
| R7  | Both mutate the same symbol, line ranges unknown                         | —                                     | —          | No: hint "both modify X"             |
| R8  | Both mutate the same file, disjoint ranges                               | —                                     | —          | No: hint "likely overlap_compatible" |
| R9  | Only overlap is a hot or generated file                                  | —                                     | —          | No: hint "low-signal overlap"        |
- When several settling rules fire, keep the most severe and attach all evidence.
- Non-settling rules produce **hints**. They are passed to steps 4 and 5 as features and evidence.
- Line ranges from different `base_rev`s must be rebased (or the rule skipped) before R1 is applied.

**Outputs:** Either a settled `Judgment` (`source: rule`) or `(pair, hints[])` for the next step.
**Failure handling:** If merge simulation fails (branch missing, git error), skip R3 and continue; never fail the whole event.
**Latency budget:** < 20 ms per pair for R1, R2 and R4–R9; R3 ≤ 1 s and may run asynchronously for `edit` events.

---

### Step 4 — Pair model

**Goal:** Label the pairs no rule could settle, quickly and cheaply.

**Inputs:** Unsettled `(new, candidate, hints)`.
**Needs to know:** Text forms of both events (intent, touches, references, diff excerpt), the hints, and retrieval reasons.

**Model input format** (same format for training and inference):
```
[NEW]   intent | op path::symbol L.. | uses: ...  | diff excerpt
[OTHER] intent | op path::symbol L.. | uses: ...  | diff excerpt
[HINTS] both modify billing.client.pay; retrieved via reference-graph
```

**Model options (choose by phase):**
| Phase | Model                                                                                                 | Notes                                                           |
| ----- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| v0    | _None_: skip straight to step 5 for every unsettled pair                                              | Collect LLM verdicts as labels                                  |
| v1    | Cross-encoder (ModernBERT / DeBERTa-v3 / UniXcoder) fine-tuned as a 7-way classifier + direction head | ~10 ms on CPU; trained on distilled LLM labels + outcome labels |
| v2    | Add graph features or a GNN over events + code entities                                               | When multi-hop semantic conflicts matter                        |

**Output:** Probability for each relation, plus direction for asymmetric ones. Confidence = top-class probability after **calibration** (temperature scaling on a held-out set).

**Escalate to step 5 when:**
- top confidence < 0.7, **or**
- the predicted relation is severe (`semantic_conflict`, `intent_contradiction`) and confidence < 0.9, **or**
- the top two classes are within 0.15 of each other.

**Failure handling:** If the model is unavailable, escalate everything to step 5 within budget; anything over budget gets a `fallback` judgment (§5 Step 6).
**Latency budget:** < 30 ms per pair, batched.

---

### Step 5 — LLM adjudicator (optional, selective)

**Goal:** Resolve ambiguous or high-stakes pairs with stronger reasoning, and produce a readable explanation.

**Inputs:** Escalated pairs with the step-4 distribution (if any) and all hints.
**Needs to know:** Everything in step 4, plus (when available) larger diff context and the signatures or docstrings of symbols involved.

**Process:**
1. Build a prompt with: label definitions (§4.2) with one example each; the two event summaries; hints and retrieval reasons; the step-4 guess (optional, to avoid anchoring in evals).
2. Call a small, fast model (e.g. a Haiku-class model) with **structured output**:

   ```json
   { "relation": "...", "direction": "...", "confidence": 0.0, "rationale": "1–3 sentences citing specific symbols/lines" }
   ```
3. Validate the output against the schema. Clamp confidence to [0, 1].
4. Treat the model's confidence as a hint, not a calibrated probability. Calibrate it against logged outcomes before it gates `block`.

**Invocation limits:** max N calls per event (default 5, highest retrieval score first), global rate limit, per-day cost cap.
**Failure handling:** On timeout, refusal, schema failure or budget exhaustion, return no verdict. The pair gets a `fallback` judgment with the hints as evidence, and a `warn` if any hint involved a mutated symbol.
**Latency budget:** 1–3 s per call, run concurrently. Intent events can tolerate this; edit events in a tight loop may run step 5 asynchronously and update the judgment afterwards.

---

### Step 6 — Decide action & emit

**Goal:** Turn (relation, confidence) into a recommended action, and aggregate per event.

**Default policy** (configurable):
| Relation               | Action if confidence ≥ threshold | Threshold | Below threshold |
| ---------------------- | -------------------------------- | --------- | --------------- |
| `independent`          | ignore                           | —         | ignore          |
| `overlap_compatible`   | ignore                           | —         | ignore          |
| `duplicate`            | warn                             | 0.7       | ignore          |
| `textual_conflict`     | serialize                        | 0.8       | warn            |
| `semantic_conflict`    | block                            | 0.85      | warn            |
| `intent_contradiction` | block                            | 0.8       | warn            |
| `ordering_dependency`  | serialize (dependent waits)      | 0.7       | warn            |
- **Fallback judgments** (no rule, no model verdict): `overlap_compatible` at 0.3 if hints exist, else `independent` at 0.5.
- **Kind adjustment:** for `intent` events, cap actions at `serialize`. Plans are uncertain, so a plan alone never causes a `block`.
- **De-duplication:** if the same pair already has an open judgment with the same relation, don't re-alert. Only alert when severity increases.
- **Rollup:** `worst_action` across all judgments decides what happens to the new event.

**Output:** The final list of judgments + `worst_action`.

---

### Step 7 — Log everything

Every judgment is stored, including `ignore`s. The log is the training set for v1.

**Judgment log fields:** all fields from §4.4, plus a snapshot (or hash and pointer) of both event versions, the hints, and the step-4 class distribution.

**Outcome fields** (filled in later):
| Outcome                 | How it's detected                           | Label meaning                       |
| ----------------------- | ------------------------------------------- | ----------------------------------- |
| `merge_conflict`        | Merge of the two branches failed            | Confirms textual conflict           |
| `post_merge_ci_failure` | Both passed CI alone; combined build failed | Strong semantic-conflict label      |
| `revert`                | Either change reverted within N days        | Weak conflict label                 |
| `clean_merge`           | Both merged and CI stayed green             | Evidence for independent/compatible |
| `human_override`        | A human dismissed a warn/block              | Likely false positive               |
| `human_confirmed`       | A human acted on the alert                  | True positive                       |

**Training export:** `(new_event_text, other_event_text, hints) → relation` pairs, labelled from outcomes where available, otherwise from LLM verdicts. Keep the LLM-only labels marked so they can be weighted down.

---

## 6. Re-classification triggers

A judgment isn't permanent. Re-run steps 2–6 for an event when:
- Its `kind` moves from `intent` → `edit` (real footprint replaces the guessed one).
- Its diff changes materially (new files or symbols touched).
- A related event's status changes (e.g. the other agent finished; a `serialize` can release).
- `base_rev` changes (rebase): line ranges and merge simulation must be redone.
- The codebase index refreshes in a way that changes references of touched symbols.

---

## 7. Evaluation

| Metric                                                                          | Target (initial) | Why                                                       |
| ------------------------------------------------------------------------------- | ---------------- | --------------------------------------------------------- |
| Precision of `block` + `serialize`                                              | ≥ 0.85           | False alarms train people to ignore the system            |
| Recall on real conflicts (merge failures + post-merge CI failures)              | ≥ 0.8            | The point of the system                                   |
| Candidate recall (step 2): share of real conflicts present in the candidate set | ≥ 0.95           | Later steps can't recover a pair that was never retrieved |
| p95 latency per event (excluding async LLM)                                     | < 300 ms         | Must not slow agents down                                 |
| LLM calls per event                                                             | < 1 on average   | Cost control                                              |
| Calibration error (ECE) for confidence                                          | < 0.1            | Thresholds only work if confidence means something        |

**Test sets:**
1. **Mined:** pairs of PRs from open-source repos with merge conflicts or post-merge CI failures (positives) and clean concurrent merges (negatives).
2. **Synthetic:** pairs generated per relation label (including hard negatives like "add X" vs "document X"), reviewed by a human.
3. **In-house:** logged judgments with outcomes, refreshed weekly.

---

## 8. Phased rollout

| Phase  | Steps active     | Pair model                                                       | Purpose                                                     |
| ------ | ---------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| **v0** | 1, 2, 3, 5, 6, 7 | none (LLM handles every unsettled pair, within budget)           | Ship quickly, collect labels; run in `warn`-only mode first |
| **v1** | 1–7              | Cross-encoder distilled from v0 logs + outcomes                  | Cut cost and latency; LLM only on escalations               |
| **v2** | 1–7              | + graph features / GNN; JEPA-style latent prediction as research | Catch multi-hop semantic conflicts                          |

Turn on `block` only after the measured precision of that relation clears the target in shadow mode.

---

## 9. Open questions

1. **Granularity of intents:** how do agents declare plans: free text only, or a structured "files/symbols I expect to touch" list? (Structured is far better for step 2.)
2. **Who acts on `serialize`/`block`?** The orchestrator automatically, or a human?
3. **Same-task overlap:** should sub-agents of one task be checked against each other, or are they trusted to coordinate?
4. **Cross-repo work:** are references across repositories or services in scope?
5. **Index freshness:** how stale can the symbol and reference index be before step 1 and step 3 become unreliable?
6. **Privacy / cost:** may diffs be sent to an external LLM, or must step 5 run on a self-hosted model?
