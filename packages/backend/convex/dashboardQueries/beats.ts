import type { BoardCatch } from "./catches";
import type { BoardGoal, BoardShared } from "./goals";
import { capitalize, lowerFirst, subjectThing } from "./labels";
import { payloadField } from "./shared";
import type { Source } from "./source";
import type { BoardTask } from "./tasks";

export type Tone = "hot" | "warn" | "faint";
/** The top-bar caption: the latest notable thing at a given time. */
export type Beat = { t: number; text: string; tone: Tone };

const BEAT_LIMIT = 40;
const COUNT = ["No", "One", "Two", "Three", "Four", "Five", "Six"];

export function buildBeats(
  src: Source,
  goals: BoardGoal[],
  tasks: BoardTask[],
  shared: BoardShared[],
  catches: BoardCatch[],
): Beat[] {
  const handles = new Map<string, string>(src.handles);
  const who = (agentId: string) => capitalize(handles.get(agentId) ?? "an agent");
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const beats: Beat[] = [];
  const first = goals[0];
  if (first) {
    const n = new Set(goals.map((g) => g.agentId)).size;
    beats.push({
      t: first.t0,
      text: n === 1 ? `${who(first.agentId)} starts` : `${COUNT[n] ?? n} agents start`,
      tone: "faint",
    });
  }
  for (const t of tasks) {
    const fail = t.actions.find((a) => a.outcome === "failed");
    if (fail && t.state === "abandoned") {
      beats.push({
        t: fail.t,
        text: `${who(t.agentId)}'s ${lowerFirst(subjectThing(t.subject))} attempt fails`,
        tone: "hot",
      });
    }
  }
  for (const s of shared) {
    if (s.kind === "lesson") beats.push({ t: s.t, text: "It becomes a lesson", tone: "faint" });
    else
      beats.push({ t: s.t, text: `${who(s.agentId)} decides: ${s.label.split(" = ").pop()}`, tone: "faint" });
  }
  for (const c of catches) {
    const from = taskById.get(c.from);
    const to = taskById.get(c.to);
    if (c.kind === "duplicate") {
      beats.push({
        t: c.t,
        text: `Duplicate ${lowerFirst(subjectThing(from?.subject ?? "work"))} stopped`,
        tone: "warn",
      });
    } else if (c.kind === "stale") {
      beats.push({
        t: c.t,
        text: `${from ? who(from.agentId) : "An agent"} steered off the failed path`,
        tone: "warn",
      });
    } else if (c.kind === "ordering") {
      beats.push({ t: c.t, text: `${from ? who(from.agentId) : "An agent"} waits: ${c.chip}`, tone: "warn" });
    } else if (c.kind === "takeover") {
      const what = c.topic ?? lowerFirst(subjectThing(from?.subject ?? "the work"));
      beats.push({
        t: c.t,
        text: `${from ? who(from.agentId) : "An agent"} takes over ${what}`,
        tone: "faint",
      });
    } else {
      const a = subjectThing(to?.subject ?? "one side");
      const b = lowerFirst(subjectThing(from?.subject ?? "the other"));
      beats.push({ t: c.t, text: `Conflict: ${a} vs ${b}`, tone: "hot" });
    }
  }
  for (const e of src.events) {
    if (e.source !== "verify") continue;
    const conflicts = payloadField(e, "conflicts");
    const clean = !(Array.isArray(conflicts) && conflicts.length > 0) && payloadField(e, "passed") !== false;
    beats.push({
      t: e.at,
      text: clean ? "All branches merge clean" : "Merge check failed",
      tone: clean ? "faint" : "hot",
    });
  }
  return beats.sort((a, b) => a.t - b.t).slice(-BEAT_LIMIT);
}
