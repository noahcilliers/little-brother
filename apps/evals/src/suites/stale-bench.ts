import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { sh } from "../exec";
import { type PairTask, PYTHON_TOOLS } from "./pair-task";
import { CACHE, ensureVenv, pythonEnv } from "./python-env";
import { gradeConstructed, gradeRealPair } from "./stale-grade";
import { HELPERS, type Mechanism, taskA, taskB } from "./stale-specs";
import { prDescription } from "./trac";

export const STALE_DIR = join(CACHE, "benchmarks", "STALE-bench");
const DJANGO = join(CACHE, "repos", "django");

const Instance = z.object({
  id: z.string(),
  tier: z.string(),
  base_commit: z.string(),
  prs: z.array(z.number()),
  per_pr: z.record(z.object({ code_files: z.array(z.string()), fail_to_pass: z.array(z.string()) })),
});
type Instance = z.infer<typeof Instance>;

const Meta = z.object({
  pr: z.number(),
  title: z.string(),
  body: z.string().nullable().optional(),
  labels: z.array(z.string()),
});

const RealStale = z.object({
  id: z.string(),
  symbol: z.string(),
  mechanism: z.enum(["rename", "signature", "rettype"]),
  task_B: z.string(),
  oracle_test: z.string(),
  anchored_to_pair: z.string(),
});

const jsonl = <T>(file: string, schema: z.ZodType<T>): T[] =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => schema.parse(JSON.parse(l)));

/** Pilot defaults: four real-derived pairs (each mechanism), two small mined pairs, two controls. */
export const STALE_DEFAULT = [
  "phone2numeric__rename",
  "get_text_list__signature",
  "int_to_base36__rettype",
  "normalize_newlines__rename",
  "django__20060_20183",
  "django__21427_21447",
  "django__17643_17916",
  "django__16757_17643",
];

/** Django's runtime dependencies plus the optional ones the chosen test labels import. */
const DJANGO_PACKAGES = ["asgiref>=3.8", "sqlparse>=0.5", "tzdata", "Pillow", "PyYAML", "jinja2", "docutils"];

const HANDLES = ["noah", "ash"] as const;

function common(venv: string) {
  return {
    suite: "stale" as const,
    repoCache: DJANGO,
    env: (cwd: string) => pythonEnv(venv, cwd),
    extraTools: PYTHON_TOOLS,
  };
}

const NOTE =
  "This is a Django checkout; `python` has its dependencies and imports Django from this directory. Don't install packages.";

function realTask(inst: Instance, venv: string): PairTask {
  const prs = inst.prs.map((pr) => {
    const dir = join(STALE_DIR, "patches", "django", `pr${pr}`);
    const meta = Meta.parse(JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")));
    return {
      pr,
      meta,
      testPatch: join(dir, "test.patch"),
      failToPass: inst.per_pr[String(pr)]?.fail_to_pass ?? [],
    };
  });
  return {
    ...common(venv),
    id: inst.id,
    kind: inst.tier,
    base: inst.base_commit,
    expectClash: inst.tier === "coupled",
    agents: prs.map((p, i) => ({
      handle: HANDLES[i] ?? `agent${i}`,
      prompt: [
        `Implement this Django change (pull request #${p.pr}).`,
        "",
        prDescription(p.meta.title, p.meta.body ?? ""),
        "",
        `Add or update tests as you see fit. Relevant tests: \`python tests/runtests.py ${p.meta.labels.join(" ")}\`. ${NOTE}`,
      ].join("\n"),
    })),
    grade: (g) =>
      gradeRealPair(g, venv, {
        prs: prs.map((p) => ({
          pr: p.pr,
          testPatch: p.testPatch,
          labels: p.meta.labels,
          failToPass: p.failToPass,
        })),
      }),
  };
}

function constructedTask(spec: z.infer<typeof RealStale>, base: string, venv: string): PairTask {
  const fn = spec.symbol.split(".").pop() ?? spec.symbol;
  const helper = HELPERS[fn];
  if (!helper) throw new Error(`no helper spec for ${spec.symbol}`);
  const mechanism: Mechanism = spec.mechanism;
  const [a, b] = HANDLES;
  return {
    ...common(venv),
    id: spec.id,
    kind: `constructed:${mechanism}`,
    base,
    expectClash: true,
    agents: [
      { handle: a, prompt: `${taskA(helper, mechanism)} ${NOTE}` },
      { handle: b, prompt: `${taskB(helper, spec.task_B)} ${NOTE}`, afterFirstEditOf: a },
    ],
    grade: (g) => gradeConstructed(g, venv, { helper, mechanism, oracle: spec.oracle_test }),
  };
}

/** Every STALE-bench Django task we can run, by id; `ids` picks a subset (default: the pilot set). */
export function staleTasks(ids: string[]): PairTask[] {
  if (!existsSync(STALE_DIR))
    throw new Error(`clone https://github.com/illinoisdata/STALE-bench to ${STALE_DIR} first`);
  if (!existsSync(DJANGO)) throw new Error(`clone https://github.com/django/django to ${DJANGO} first`);
  sh("git", ["fetch", "-q", "origin"], DJANGO);
  const venv = ensureVenv("django", DJANGO_PACKAGES);
  const mined = [
    ...jsonl(join(STALE_DIR, "instances", "django.jsonl"), Instance),
    ...jsonl(join(STALE_DIR, "instances", "control.jsonl"), Instance),
  ];
  const byId = new Map(mined.map((i) => [i.id, i]));
  const constructed = jsonl(join(STALE_DIR, "results", "realstale_batch.jsonl"), RealStale);
  const want = ids.length ? ids : STALE_DEFAULT;
  return want.map((id) => {
    const spec = constructed.find((s) => s.id === id);
    if (spec) {
      const anchor = byId.get(spec.anchored_to_pair);
      if (!anchor) throw new Error(`${id}: anchor ${spec.anchored_to_pair} not in instances`);
      return constructedTask(spec, anchor.base_commit, venv);
    }
    const inst = byId.get(id);
    if (!inst) throw new Error(`unknown STALE-bench task ${id}`);
    return realTask(inst, venv);
  });
}
