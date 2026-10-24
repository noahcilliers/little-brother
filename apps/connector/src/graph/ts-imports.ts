import { importMap } from "../normalize/references";
import { parse, type TsModule } from "../normalize/ts-symbols";

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Repo graph keys one JS/TS file imports, using the same import resolution as the edit normalizer so keys
 * line up with touch symbols. Namespace imports narrow to the members the file uses; bare package imports
 * (`react`, workspace packages) are dropped because no touch in this repo can name them.
 */
export function tsImportKeys(
  ts: TsModule,
  rel: string,
  text: string,
  root: string,
  known: Set<string>,
): Set<string> {
  const keys = new Set<string>();
  const sf = parse(ts, rel, text);
  for (const [local, imp] of importMap(ts, sf, rel, root)) {
    if (!known.has(imp.module)) continue;
    if (imp.name !== "*") {
      keys.add(`${imp.module}::${imp.name}`);
      continue;
    }
    let used = false;
    for (const m of text.matchAll(
      new RegExp(`(?<![\\w.$])${escapeRegex(local)}\\.([A-Za-z_$][\\w$]*)`, "g"),
    )) {
      if (!m[1]) continue;
      keys.add(`${imp.module}::${m[1]}`);
      used = true;
    }
    if (!used) keys.add(`${imp.module}::*`);
  }
  return keys;
}
