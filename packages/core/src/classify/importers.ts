import type { Op } from "../ingest";
import type { ImporterLink } from "../repo-graph";
import { isMutation, symbolName } from "./touches";
import type { ClassifiedNode } from "./types";

/** Changes that break a symbol's importers: what R12 and the importer candidate signal look for. */
export const INTERFACE_OPS: ReadonlySet<Op> = new Set<Op>(["signature_change", "rename", "delete"]);

export type ImporterHit = { symbol: string; file: string; via: ImporterLink["via"]; op: Op };

/**
 * Files `user` mutates that import a symbol whose interface `changer` changes, per the repo graph links
 * stored on `changer`. Name-level imports come first: they are the stronger evidence.
 */
export function importerHits(changer: ClassifiedNode, user: ClassifiedNode): ImporterHit[] {
  if (!changer.importers?.length) return [];
  const mutated = new Set(user.touches.filter((t) => isMutation(t) && !t.generated).map((t) => t.path));
  const out: ImporterHit[] = [];
  for (const link of changer.importers) {
    const touch = changer.touches.find(
      (t) => (t.symbol ?? t.path) === link.symbol && INTERFACE_OPS.has(t.op),
    );
    for (const file of link.files) {
      if (mutated.has(file))
        out.push({ symbol: link.symbol, file, via: link.via, op: touch?.op ?? "signature_change" });
    }
  }
  return out.sort((a, b) => (a.via === b.via ? 0 : a.via === "symbol" ? -1 : 1));
}

/** "signature of format_name changes", "format_name is renamed", "helpers.py is deleted". */
export function describeInterfaceChange(h: Pick<ImporterHit, "symbol" | "op">): string {
  const name = symbolName(h.symbol);
  if (h.op === "rename") return `${name} is renamed`;
  if (h.op === "delete") return `${name} is deleted`;
  return `signature of ${name} changes`;
}
