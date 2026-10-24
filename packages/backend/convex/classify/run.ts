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

const MAX_JUDGE_CALLS = 5;
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
export const classifyNode = internalAction({
  args: { nodeId: v.id("nodes") },
  handler: async (ctx, { nodeId }) => {
    const c = await ctx.runQuery(internal.classify.db.context, { nodeId });
    if (!c) return;
    const view = c.view;
    const vector = c.embedded ? null : await embedAndStore(ctx, nodeId, view.text);
    // Lessons and facts are memory to be retrieved, not work that can collide.
    if (view.kind === "knowledge") return;
    const semantic = await semanticCandidates(ctx, nodeId, vector);
    const structural = classifyStructural(view, [...semantic, ...c.structural], { thresholds: c.thresholds });
    const judge = selectJudge();
    const unsettled = [...structural.unsettled]
      // Test and build runs are evidence about code, not approaches; rules (R10/R11) already use them.
      .filter(({ pair }) => !/^(TEST|RUN)$/.test(pair.other.verb))
      .filter(({ pair }) => judgeWorthy(pair, pair.failedMemory ? 0.5 : 0.8))
      .sort((a, b) => b.pair.retrievalScore - a.pair.retrievalScore);
    // Commands (tests, builds) are re-run constantly; they are not approaches a model should weigh.
    const toJudge = judge && !/^(TEST|RUN)$/.test(view.verb) ? unsettled.slice(0, MAX_JUDGE_CALLS) : [];
    const examples = toJudge.length
      ? await ctx.runQuery(internal.classify.db.examples, {
          near: structural.pairs.map((p) => p.other.id as Id<"nodes">),
        })
      : [];
    const judged: Judgment[] = [];
    for (const { pair, hints } of toJudge) {
      const started = Date.now();
      const verdict = judge ? await judge.judge(pair, hints, examples).catch(() => null) : null;
      judged.push(
        verdict
          ? decide(verdict, pair, { nextKind: view.kind, thresholds: c.thresholds }, Date.now() - started)
          : fallbackJudgment(pair, hints),
      );
    }
    await ctx.runMutation(internal.classify.db.persist, {
      nodeId,
      judgments: [...structural.judgments, ...judged],
    });
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
