import type { CandidatePair, ClassifiedNode } from "../src/classify/types";

let seq = 0;
export function node(p: Partial<ClassifiedNode> = {}): ClassifiedNode {
  seq += 1;
  return {
    id: `n${seq}`,
    agentId: "a",
    kind: "action",
    verb: "EDIT",
    text: "EDIT x",
    outcome: "open",
    touches: [],
    references: [],
    at: 1000 + seq,
    ...p,
  };
}

export function pair(next: ClassifiedNode, other: ClassifiedNode, failedMemory = false): CandidatePair {
  return { next, other, retrievalScore: 1, reasons: ["test"], failedMemory };
}
