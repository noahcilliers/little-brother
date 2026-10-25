import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ARMS, type Arm, armOf } from "./arm";
import { type AnyRun, armStats, type Diff, METRICS, type Metric, pairedDiff } from "./multi-arm";
import type { PairedStat } from "./paired";

// pnpm --filter @lb/evals multi-arm --suite "STALE-bench constructed=dirA,dirB" --suite "CooperBench=dirC" \
//   --out-md report.md --out-json summary.json
// Per suite and arm: means ± SE; then lb − off, lb − msg and lb − oracle paired by block, with bootstrap CIs.

const LABEL: Record<Metric, string> = {
  success: "Merged / final success",
  interference: "Interference (Δblind > 0)",
  conflict: "Merge conflict",
  solved: "Own task solved alone",
  tokens: "New tokens / run",
  costUsd: "$ / run",
  wallSec: "Wall time / run",
};

function fmt(m: Metric, x: number): string {
  if (m === "tokens") return `${x < 0 ? "−" : ""}${(Math.abs(x) / 1000).toFixed(1)}k`;
  if (m === "costUsd") return `${x < 0 ? "−" : ""}$${Math.abs(x).toFixed(3)}`;
  if (m === "wallSec") return `${x < 0 ? "−" : ""}${Math.round(Math.abs(x))} s`;
  return `${x < 0 ? "−" : ""}${Math.round(Math.abs(x) * 100)}%`;
}

const stat = (m: Metric, s: PairedStat) =>
  s.mean === null ? "–" : s.se === null ? fmt(m, s.mean) : `${fmt(m, s.mean)} ± ${fmt(m, s.se)}`;

function diff(m: Metric, d: Diff): string {
  if (d.mean === null) return "–";
  const ci = d.ci ? ` [${fmt(m, d.ci[0])}, ${fmt(m, d.ci[1])}]` : "";
  const unit = m === "tokens" || m === "costUsd" || m === "wallSec" ? "" : " pt";
  const se = d.se === null ? "" : ` ± ${fmt(m, d.se)}`;
  return `${fmt(m, d.mean).replace("%", unit)}${se.replace("%", unit)}${ci.replaceAll("%", unit)} (n=${d.n})`;
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      suite: { type: "string", multiple: true },
      title: { type: "string" },
      "out-md": { type: "string" },
      "out-json": { type: "string" },
    },
  });
  const suites = (values.suite ?? []).map((spec) => {
    const [name = "", dirs = ""] = spec.split("=");
    const runs = dirs
      .split(",")
      .filter(Boolean)
      .flatMap((d) => JSON.parse(readFileSync(resolve(d, "runs.json"), "utf8")) as AnyRun[]);
    return { name, runs };
  });
  const md: string[] = [`# ${values.title ?? "Multi-arm eval"}`, ""];
  const json: Record<string, unknown> = {};
  for (const s of suites) {
    const arms = ARMS.filter((a) => s.runs.some((r) => armOf(r) === a));
    const stats = arms.map((a) => armStats(s.runs, a));
    const name = (a: Arm) => (a === "on" ? "lb" : a);
    const pairs = (["off", "msg", "oracle"] as Arm[]).filter((b) => b !== "on" && arms.includes(b));
    const diffs = Object.fromEntries(
      pairs.map((b) => [
        `lb-${b}`,
        Object.fromEntries(METRICS.map((m) => [m, pairedDiff(s.runs, "on", b, m)])),
      ]),
    );
    json[s.name] = { arms: Object.fromEntries(stats.map((x) => [name(x.arm), x])), diffs };
    md.push(
      `## ${s.name}`,
      "",
      `| Metric | ${arms.map(name).join(" | ")} |`,
      `| --- | ${arms.map(() => "---").join(" | ")} |`,
      `| Runs (errors) | ${stats.map((x) => `${x.runs} (${x.errors})`).join(" | ")} |`,
      ...METRICS.map((m) => `| ${LABEL[m]} | ${stats.map((x) => stat(m, x[m])).join(" | ")} |`),
      "",
    );
    if (arms.includes("on") && pairs.length)
      md.push(
        "Paired differences (lb minus the other arm, same task and repetition): mean ± SE [95% bootstrap CI].",
        "",
        `| Metric | ${pairs.map((b) => `lb − ${b}`).join(" | ")} |`,
        `| --- | ${pairs.map(() => "---").join(" | ")} |`,
        ...METRICS.map(
          (m) =>
            `| ${LABEL[m]} | ${pairs.map((b) => diff(m, (diffs[`lb-${b}`] as Record<Metric, Diff>)[m])).join(" | ")} |`,
        ),
        "",
      );
  }
  if (values["out-md"]) {
    mkdirSync(dirname(resolve(values["out-md"])), { recursive: true });
    writeFileSync(resolve(values["out-md"]), md.join("\n"));
  } else console.log(md.join("\n"));
  if (values["out-json"]) {
    mkdirSync(dirname(resolve(values["out-json"])), { recursive: true });
    writeFileSync(resolve(values["out-json"]), `${JSON.stringify(json, null, 2)}\n`);
  }
}

main();
