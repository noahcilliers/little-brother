"use node";

import {
  acceptComparison,
  acceptDistilled,
  type Candidate,
  classifyStructural,
  comparisonPrompt,
  type Distiller,
  decide,
  distillPrompt,
  distillTrajectory,
  fallbackJudgment,
  isCrossCutting,
  type Judgment,
  judgeWorthy,
  type StoredNode,
  type TrajectoryStep,
} from "@lb/core";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { type ActionCtx, internalAction } from "../_generated/server";
import { selectEmbedder, selectJudge } from "./adapters/select";
import { pairModelTier } from "./pairTier";

const MAX_JUDGE_CALLS = 4;
const VECTOR_LIMIT = 16;

async function embedAndStore(ctx: ActionCtx, nodeId: Id<"nodes">, text: string): Promise<number[] | null> {
  const embedder = selectEmbedder();
  if (!embedder) return null;
  try {
    const [vector] = await embedder.embed([text]);
    if (!vector) return null;
    await ctx.runMutation(internal.classify.db.storeEmbedding, { nodeId, embedding: vector });
    return vector;
  } catch {
    return null;
  }
}

/** Vector hits when the embedder ran, lexical matches otherwise ("if the embedder is down, fall back"). */
async function semanticCandidates(
  ctx: ActionCtx,
  nodeId: Id<"nodes">,
  vector: number[] | null,
): Promise<Candidate[]> {
  if (!vector) return ctx.runQuery(internal.classify.db.lexicalCandidates, { nodeId });
  const hits = await ctx.vectorSearch("nodes", "by_embedding", {
    vector,
    limit: VECTOR_LIMIT,
    filter: (q) => q.or(q.eq("outcome", "open"), q.eq("outcome", "failed"), q.eq("kind", "knowledge")),
  });
  return ctx.runQuery(internal.classify.db.vectorCandidates, {
    nodeId,
    hits: hits.filter((h) => h._id !== nodeId).map((h) => ({ id: h._id, score: h._score })),
  });
}

/**
 * Async classifier (steps 2, 5, 6, 7): embed, retrieve semantically, settle with rules, send up to five
 * unsettled pairs to the judge, fall back when it is absent or fails, then persist and fan out.
 */
const MAX_ATTEMPTS = 3;

/** Short reason for the host's server log: rate limit, timeout, bad output, or the provider's own words. */
function whyFailed(e: unknown): string {
  const text = String(e);
  if (/\b429\b|RESOURCE_EXHAUSTED/.test(text)) return "rate limited (429)";
  if (/timeout|aborted/i.test(text)) return "timed out";
  if (/\b5\d\d\b|UNAVAILABLE/.test(text)) return "provider unavailable";
  return text.replace(/\s+/g, " ").slice(0, 80);
}
const RETRY_MS = 3000;

export const classifyNode = internalAction({
  args: { nodeId: v.id("nodes"), attempt: v.optional(v.number()) },
  handler: async (ctx, { nodeId, attempt = 1 }) => {
    const c = await ctx.runQuery(internal.classify.db.context, { nodeId });
    if (!c) return;
    const view = c.view;
    const vector = c.embedded ? null : await embedAndStore(ctx, nodeId, view.text);
    // Lessons and facts are memory to be retrieved, not work that can collide.
    if (view.kind === "knowledge") return;
    const semantic = await semanticCandidates(ctx, nodeId, vector);
    const structural = classifyStructural(view, [...semantic, ...c.structural], { thresholds: c.thresholds });
    const judge = selectJudge();
    const seen = new Set<string>(await ctx.runQuery(internal.classify.db.classifiedWith, { nodeId }));
    const open = [...structural.unsettled]
      .filter(({ pair }) => !seen.has(pair.other.id))
      // Test and build runs are evidence about code, not approaches; rules (R10/R11) already use them.
      .filter(({ pair }) => !/^(TEST|RUN)$/.test(pair.other.verb))
      .filter(({ pair }) => judgeWorthy(pair, pair.failedMemory ? 0.5 : 0.8))
      // Cross-cutting links first (they can actually break each other), then score, then older work: the change
      // that was there first is what the new one has to fit.
      .sort(
        (a, b) =>
          Number(isCrossCutting(b.pair)) - Number(isCrossCutting(a.pair)) ||
          b.pair.retrievalScore - a.pair.retrievalScore ||
          a.pair.other.at - b.pair.other.at,
      );
    // Step 4 (behind CLASSIFIER_PAIR_MODEL=1): the learned model settles confident pairs; the rest go to the judge.
    const unsettled = await pairModelTier(ctx, { nodeId, nextKind: view.kind, thresholds: c.thresholds }, open);
    // Commands (tests, builds) are re-run constantly; they are not approaches a model should weigh.
    const toJudge = judge && !/^(TEST|RUN)$/.test(view.verb) ? unsettled.slice(0, MAX_JUDGE_CALLS) : [];
    const examples = toJudge.length
      ? await ctx.runQuery(internal.classify.db.examples, {
          near: structural.pairs.map((p) => p.other.id as Id<"nodes">),
        })
      : [];
    // In parallel: the next hook can be seconds away, and a verdict that lands after it is a missed catch.
    const results = await Promise.all(
      toJudge.map(async ({ pair, hints }) => {
        const started = Date.now();
        let error = judge ? "no verdict" : "no judge";
        const verdict = judge
          ? await judge.judge(pair, hints, examples).catch((e: unknown) => {
              error = whyFailed(e);
              return null;
            })
          : null;
        return verdict
          ? {
              ok: true,
              j: decide(
                verdict,
                pair,
                { nextKind: view.kind, thresholds: c.thresholds },
                Date.now() - started,
              ),
            }
          : { ok: false, j: fallbackJudgment(pair, hints), error };
      }),
    );
    const judgeFailed = results.some((r) => !r.ok);
    const summary = `${view.text} #${attempt}: ${structural.pairs.length} candidates, ${structural.judgments.length} settled by rules, judged [${toJudge
      .map((t, i) => {
        const r = results[i];
        return `${t.pair.other.text.slice(0, 40)} → ${r?.ok ? r.j.relation : `FAILED (${r && "error" in r ? r.error : "?"})`}`;
      })
      .join(
        "; ",
      )}]${unsettled.length > toJudge.length ? `, skipped ${unsettled.length - toJudge.length}` : ""}${
      judge ? "" : " (no judge configured)"
    }`;
    console.log(`classify ${summary}`);
    await ctx.runMutation(internal.serverLog.recordForNode, {
      nodeId,
      level: judgeFailed ? "warn" : "info",
      kind: judgeFailed ? "judge-failed" : "classify",
      text: summary,
    });
    const judged: Judgment[] = results.map((r) => r.j);
    await ctx.runMutation(internal.classify.db.persist, {
      nodeId,
      judgments: [...structural.judgments, ...judged],
    });
    // A busy or flaky model must not silently cost a catch: re-run soon; rules and dedupe make re-runs safe.
    if (judgeFailed && attempt < MAX_ATTEMPTS) {
      await ctx.scheduler.runAfter(RETRY_MS * attempt, internal.classify.run.classifyNode, {
        nodeId,
        attempt: attempt + 1,
      });
    }
    if (judge) await compareEscalations(ctx, nodeId, judge);
  },
});

/**
 * Once both sides of an open escalation have working code, a short side-by-side for the topic owner.
 * Reserved before the model call so concurrent runs never ask twice for one classification.
 */
async function compareEscalations(ctx: ActionCtx, nodeId: Id<"nodes">, model: Distiller): Promise<void> {
  const due = await ctx.runQuery(internal.classify.compare.pending, { nodeId });
  for (const item of due) {
    if (
      !(await ctx.runMutation(internal.classify.compare.claim, { classificationId: item.classificationId }))
    )
      continue;
    const raw = await model.distill(comparisonPrompt(item)).catch(() => null);
    const comparison = acceptComparison(raw);
    if (comparison) {
      await ctx.runMutation(internal.classify.compare.store, {
        classificationId: item.classificationId,
        comparison,
      });
    }
  }
}

function step(n: StoredNode & { output?: string }): TrajectoryStep {
  return {
    verb: n.verb,
    text: n.text,
    outcome: n.outcome,
    at: n.at,
    files: n.files,
    ...(n.signature ? { signature: n.signature } : {}),
    ...(n.topic ? { topic: n.topic } : {}),
    ...(n.output ? { output: n.output } : {}),
  };
}

/**
 * Stop handler hook: distill a trajectory with failures into one knowledge node (what was tried → why it
 * failed → what worked), rewritten by the judge model when one is configured, then embed it.
 */
export const onTrajectoryEnd = internalAction({
  args: { intentId: v.id("nodes") },
  handler: async (ctx, { intentId }) => {
    const t = await ctx.runQuery(internal.classify.lessons.trajectory, { intentId });
    if (!t) return;
    const intent = step(t.intent);
    const lesson = distillTrajectory(intent, t.actions.map(step));
    if (!lesson) return;
    const judge = selectJudge();
    const text = judge
      ? acceptDistilled(await judge.distill(distillPrompt(intent, lesson)).catch(() => null), lesson)
      : lesson.text;
    const nodeId = await ctx.runMutation(internal.classify.lessons.insertLesson, {
      intentId,
      text,
      files: lesson.files,
      outcome: lesson.outcome,
      ...(lesson.topic ? { topic: lesson.topic } : {}),
      ...(lesson.signature ? { signature: lesson.signature } : {}),
    });
    if (nodeId) await embedAndStore(ctx, nodeId, text);
  },
});
