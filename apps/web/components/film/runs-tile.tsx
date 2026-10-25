import type { CSSProperties } from "react";
import { clamp01 } from "./film-clock";
import type { Placed } from "./runs-schedule";
import { SCRIPTS } from "./runs-scripts";

// One headless agent pair running one benchmark task, as a tiny terminal: its tool calls scroll by, Little
// Brother's block lands mid-run on a catch, and the run's logged result closes it.

/** Share of a run spent scrolling tool calls; the rest holds the result line. */
const WORK = 0.82;
const FLASH_S = 0.45;

type Event = { kind: "line"; who: string; tool: string; arg: string } | { kind: "catch"; text: string };

/** "pallets_jinja_task/1621/5+8" reads as the task plus its feature pair. */
function caseLabel(caseId: string): [id: string, sub: string] {
  const parts = caseId.split("/");
  return parts.length === 3 ? [parts.slice(0, 2).join("/"), `features ${parts[2]}`] : [caseId, "django"];
}

/** run: the tile's current or last run; u: batch progress; sPerU: film seconds per unit of u, for the flash. */
export function RunTile({ run, u, sPerU }: { run: Placed | undefined; u: number; sPerU: number }) {
  const script = run ? SCRIPTS[run.row[0]] : undefined;
  if (!run || !script) return <div className="rn-tile" />;
  const [caseId, arm, n, wallSec, solved, outcome] = run.row;
  const p = clamp01((u - run.start) / Math.max(1e-6, run.end - run.start));
  const caught = outcome === "hit" ? script.conflict : outcome === "mislabel" ? script.duplicate : undefined;
  const events: Event[] = script.lines.map(([who, tool, arg]) => ({
    kind: "line",
    who: script.agents[who],
    tool,
    arg,
  }));
  const at = Math.ceil(events.length / 2);
  if (caught)
    events.splice(at, 0, {
      kind: "catch",
      text: `${outcome === "hit" ? "conflict" : "duplicate"} · ${caught}`,
    });
  const shown = Math.min(events.length, Math.ceil((p / WORK) * events.length));
  const caughtAtU = run.start + (at / events.length) * WORK * (run.end - run.start);
  const since = (u - caughtAtU) * sPerU;
  const flash = caught && since >= 0 && since < FLASH_S ? 1 - since / FLASH_S : 0;
  const done = p >= 1;
  const [id, sub] = caseLabel(caseId);
  return (
    <div className={done ? "rn-tile done" : "rn-tile"} style={{ "--rn-flash": flash } as CSSProperties}>
      <div className="rn-head">
        <b>{id}</b>
        <span>
          {arm} #{n}
        </span>
        <small>
          {script.suite} · {sub}
        </small>
      </div>
      <div className="rn-body">
        {events.slice(0, shown).map((e, i) =>
          e.kind === "catch" ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: a run's events never reorder
            <p key={i} className="rn-catch">
              <b>deny</b> {e.text}
            </p>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: a run's events never reorder
            <p key={i} className="rn-line">
              <i>{e.who}</i> <b>{e.tool}</b> {e.arg}
            </p>
          ),
        )}
      </div>
      <p className="rn-foot">
        {done ? (
          <>
            <span className="rn-solved">solved {solved}</span>
            {outcome ? <span className={`rn-out ${outcome}`}>{outcome}</span> : null}
            <span>{wallSec} s</span>
          </>
        ) : (
          <span>running · {Math.round(p * wallSec)} s</span>
        )}
      </p>
    </div>
  );
}
