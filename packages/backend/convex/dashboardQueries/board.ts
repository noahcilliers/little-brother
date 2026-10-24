import { buildBeats } from "./beats";
import { buildCatches } from "./catches";
import { buildDecisions } from "./decisions";
import { buildGoals, buildShared } from "./goals";
import { capitalize } from "./labels";
import { buildSessions } from "./sessions";
import { type Ctx, payloadField, payloadString } from "./shared";
import { loadSource, type Source } from "./source";
import { buildTasks } from "./tasks";

function verifyBadges(src: Source) {
  return src.events
    .filter((e) => e.source === "verify" && payloadField(e, "background") !== true)
    .map((e) => {
      const conflicts = payloadField(e, "conflicts");
      const conflicted = Array.isArray(conflicts) && conflicts.length > 0;
      const passed = payloadField(e, "passed") === true;
      const n = payloadString(e, "outputTail")?.match(/(\d+) passed/)?.[1];
      const text = conflicted
        ? "merge conflict"
        : !passed
          ? "merge tests fail"
          : n
            ? `merged · ${n}/${n}`
            : "merged clean";
      return { id: e._id as string, t: e.at, ok: passed && !conflicted, text };
    });
}

function agentRows(src: Source) {
  return src.agents.map((a) => {
    const handle = src.handles.get(a._id) ?? "agent";
    return {
      id: a._id as string,
      handle,
      name: capitalize(handle),
      color: src.colors.get(a._id) ?? 1,
      branch: a.branch,
      active: a.status === "active",
    };
  });
}

/** Everything the one-screen dashboard needs; the client only lays it out on the time axis. */
export async function board(ctx: Ctx) {
  const src = await loadSource(ctx);
  const { tasks, taskOfNode, loose } = buildTasks(src);
  const goals = buildGoals(src, tasks);
  const shared = buildShared(src, tasks, taskOfNode);
  const catches = buildCatches(src, tasks, taskOfNode, new Set(shared.map((s) => s.id)));
  // A superseded task reads as done until the decision that superseded it lands.
  for (const t of tasks) {
    if (t.state !== "superseded") continue;
    const settled = catches.filter((c) => c.kind === "conflict" && (c.from === t.id || c.to === t.id));
    const at = settled.map((c) => c.until ?? 0).reduce((a, b) => Math.max(a, b), 0);
    t.supersededAt = Math.max(t.t1 ?? t.t0, at);
  }
  const live = src.recentVerdicts.filter((c) => c.type !== "normal");
  return {
    repo: src.agents[0]?.repo ?? "",
    agents: agentRows(src),
    goals,
    tasks,
    loose,
    decisions: buildDecisions(src, tasks, taskOfNode),
    shared,
    catches,
    sessions: buildSessions(src, tasks, taskOfNode),
    verifies: verifyBadges(src),
    beats: buildBeats(src, goals, tasks, shared, catches),
    counts: {
      // Git-found misses never fired live, so they are not catches; they are what recall is measured against.
      caught: live.filter((c) => c.status !== "dismissed" && c.gitStatus !== "missed").length,
      missed: live.filter((c) => c.gitStatus === "missed").length,
    },
  };
}
