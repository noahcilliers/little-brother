import { LandingEvals } from "@lb/core";
import raw from "./landing-evals.json";

/**
 * The eval section's bundled data, written by `pnpm --filter @lb/evals publish-results -- --snapshot …` from
 * real results. Shown until Convex has published rows, and whenever the live query can't be reached.
 */
export const SNAPSHOT: LandingEvals = LandingEvals.parse(raw);
