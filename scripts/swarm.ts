/**
 * Generates a swarm scenario for `lb replay --parallel`: N agents working lb-demo-shop at once.
 *
 *   npx tsx scripts/swarm.ts [--agents 8] [--overlap 0.25] [--seed 1] [--tasks 3-5] [--out swarm.jsonl]
 *
 * Writes transcript snapshots to <out>.transcripts/ and prints the setup commands for the generated handles.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { generateSwarm, SWARM_DEFAULTS, swarmHandles } from "../fixtures/scripts/swarm";
import { transcriptsFor } from "../fixtures/scripts/transcripts";

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const num = (name: string, fallback: number): number => {
  const v = Number(flag(name));
  return Number.isFinite(v) && flag(name) !== undefined ? v : fallback;
};

const [minTasks, maxTasks] = (flag("tasks") ?? `${SWARM_DEFAULTS.minTasks}-${SWARM_DEFAULTS.maxTasks}`)
  .split("-")
  .map(Number);
const opts = {
  agents: Math.max(1, Math.round(num("agents", SWARM_DEFAULTS.agents))),
  overlap: Math.min(1, Math.max(0, num("overlap", SWARM_DEFAULTS.overlap))),
  seed: num("seed", SWARM_DEFAULTS.seed),
  minTasks: minTasks ?? SWARM_DEFAULTS.minTasks,
  maxTasks: maxTasks ?? minTasks ?? SWARM_DEFAULTS.maxTasks,
};
const out = resolve(flag("out") ?? "swarm.jsonl");
const story = generateSwarm(opts);
const lines = story.lines;
// Transcript snapshots next to the output, so replayed Stops price each tool call (see fixtures/README.md).
const tdir = `${out}.transcripts`;
rmSync(tdir, { recursive: true, force: true });
mkdirSync(tdir, { recursive: true });
const transcripts = transcriptsFor(lines);
for (const [step, jsonl] of transcripts) writeFileSync(`${tdir}/${step}.jsonl`, jsonl);
const rel = (step: string) => `${basename(tdir)}/${step}.jsonl`;
const withTranscripts = lines.map((l) => (transcripts.has(l.step) ? { ...l, transcript: rel(l.step) } : l));
writeFileSync(out, `${withTranscripts.map((l) => JSON.stringify(l)).join("\n")}\n`);

const handles = swarmHandles(opts.agents);
const seconds = lines.reduce((t, l) => t + l.delayMs, 0) / 1000;
const denied = lines.filter(
  (l) => l.step.endsWith(".pre") && !lines.some((m) => m.step === l.step.replace(/\.pre$/, ".post")),
);
console.log(
  `wrote ${lines.length} lines for ${handles.length} agents (${seconds.toFixed(1)} s at speed 1) to ${out}`,
);
console.log(`predicted denials: ${denied.map((l) => l.step.replace(/\.pre$/, "")).join(", ") || "none"}`);
console.log(`
setup (once per run):
  demo/setup.sh /tmp/lb-demo/shop --worktrees --agents ${handles.join(",")}
  for who in ${handles.join(" ")}; do lb join --url "$LB_SITE_URL" --as "$who"; done
replay:
  lb replay ${out} --parallel --apply --speed 2`);
