import {
  type ClassifiedNode,
  FEATURE_NAMES,
  FEATURE_VERSION,
  type PairModel,
  parsePairModel,
  settleByPairModel,
  type Thresholds,
  type Unsettled,
} from "@lb/core";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";

// Step 4 (pair model) for the async classifier. Off unless CLASSIFIER_PAIR_MODEL=1; any problem (no model,
// a model for other features, a failed write) hands every pair to the judge exactly as before.

const EXPECT = { featureVersion: FEATURE_VERSION, featureNames: FEATURE_NAMES };
let cached: { key: string; model: PairModel } | null = null;

export function pairModelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.CLASSIFIER_PAIR_MODEL === "1";
}

async function loadModel(ctx: ActionCtx): Promise<PairModel | null> {
  const entry = (await ctx.runQuery(internal.classify.pairModel.current, {})) as {
    version?: unknown;
    uploadedAt?: unknown;
    model?: unknown;
  } | null;
  if (!entry?.model) return null;
  // Parsing a large tree ensemble costs a few ms; reuse it while the stored upload is unchanged.
  const key = `${String(entry.version)}@${String(entry.uploadedAt)}`;
  if (cached?.key === key) return cached.model;
  const parsed = parsePairModel(entry.model, EXPECT);
  if (!parsed.ok) {
    console.warn(`pair model ignored: ${parsed.error}`);
    return null;
  }
  cached = { key, model: parsed.model };
  return parsed.model;
}

/**
 * Settle what the model is sure about (persisted here with source "pair_model") and return the rest, in
 * order, for the judge. Returns the input untouched when the tier is off or anything fails.
 */
export async function pairModelTier<T extends Unsettled>(
  ctx: ActionCtx,
  opts: { nodeId: Id<"nodes">; nextKind: ClassifiedNode["kind"]; thresholds: Thresholds },
  unsettled: T[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<T[]> {
  if (!pairModelEnabled(env) || unsettled.length === 0) return unsettled;
  try {
    const model = await loadModel(ctx);
    if (!model) return unsettled;
    const r = settleByPairModel(model, unsettled, { nextKind: opts.nextKind, thresholds: opts.thresholds });
    if (r.judgments.length > 0)
      await ctx.runMutation(internal.classify.db.persist, { nodeId: opts.nodeId, judgments: r.judgments });
    console.log(
      `pair model ${model.version}: settled ${r.judgments.length}/${unsettled.length} [${r.judgments
        .map((j) => `${j.relation} ${j.confidence.toFixed(2)}`)
        .join("; ")}]`,
    );
    return r.rest;
  } catch (e) {
    console.warn(`pair model failed open: ${String(e).slice(0, 120)}`);
    return unsettled;
  }
}
