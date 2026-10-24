import type { Rule } from "../types";
import { r7SameSymbol, r8DisjointRanges, r9GeneratedOnly } from "./hints";
import { r1LineOverlap } from "./r1-line-overlap";
import { r2SameCreate } from "./r2-same-create";
import { r4DeleteVsUse } from "./r4-delete-vs-use";
import { r5SignatureChange } from "./r5-signature-change";
import { r6CreateVsReference } from "./r6-create-vs-reference";
import { r10FailedSignature } from "./r10-failed-signature";
import { r11IntentTopicFailed } from "./r11-intent-topic-failed";

/**
 * Order breaks ties between equally severe rules: the more specific explanation (R2 "already being
 * created") leads. R3 (git merge-tree) runs only in `lb verify`, where both branches are available.
 */
export const RULES: Rule[] = [
  r2SameCreate,
  r1LineOverlap,
  r4DeleteVsUse,
  r5SignatureChange,
  r6CreateVsReference,
  r10FailedSignature,
  r11IntentTopicFailed,
  r7SameSymbol,
  r8DisjointRanges,
  r9GeneratedOnly,
];

export {
  r1LineOverlap,
  r2SameCreate,
  r4DeleteVsUse,
  r5SignatureChange,
  r6CreateVsReference,
  r7SameSymbol,
  r8DisjointRanges,
  r9GeneratedOnly,
  r10FailedSignature,
  r11IntentTopicFailed,
};
