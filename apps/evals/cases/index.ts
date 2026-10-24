import type { EvalCase } from "../src/case";
import { conflictAuthMechanism, conflictCorsVsProxy, conflictProductSort } from "./conflict";
import { controlConfigAndTests, controlNeighbours, controlSameMechanism, controlUnrelated } from "./controls";
import {
  orderingOrderType,
  orderingRequireAdmin,
  semanticTokenSignature,
  semanticUserRename,
} from "./dependency";
import { dupOrderEmail, dupOrderModel, dupUsersTable } from "./duplicate";
import { staleCorsWildcard, staleJsdomEnv } from "./stale";

export const CASES: EvalCase[] = [
  dupUsersTable,
  dupOrderModel,
  dupOrderEmail,
  conflictAuthMechanism,
  conflictCorsVsProxy,
  conflictProductSort,
  semanticUserRename,
  semanticTokenSignature,
  orderingOrderType,
  orderingRequireAdmin,
  staleCorsWildcard,
  staleJsdomEnv,
  controlUnrelated,
  controlSameMechanism,
  controlNeighbours,
  controlConfigAndTests,
];
