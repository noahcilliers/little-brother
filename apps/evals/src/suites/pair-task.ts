/** What a benchmark adapter grades a finished pair into. */
export type PairGrade = {
  /** The agents' branches conflicted textually when merged. */
  mergeConflict: boolean;
  /** The suite's end-to-end outcome on the merged code (CooperBench: clean merge and every feature's tests). */
  success: boolean;
  /** STALE-bench Δblind: tests passing with each branch alone that fail merged. Null where undefined. */
  interference: number | null;
  /** Per agent: its own task solved on its own branch. */
  solved: Record<string, boolean>;
  /** Evidence that the pair clashed, for detection scoring (merge conflict, interference, merged failure). */
  clash: boolean;
  detail: Record<string, unknown>;
};

export type GradeInput = {
  /** The run's private clone; agent branches are `<handle>/work`. */
  repo: string;
  base: string;
  handles: string[];
  /** Scratch directory for grading worktrees. */
  dir: string;
};

export type PairAgent = { handle: string; prompt: string; afterFirstEditOf?: string };

/** One pair of agents on one external task, with everything needed to run and grade it. */
export type PairTask = {
  suite: "stale" | "cooper";
  id: string;
  /** e.g. `constructed:rename`, `coupled`, `control`, `cooper`. */
  kind: string;
  /** A full clone that contains `base`; each run clones it with `--shared`. */
  repoCache: string;
  base: string;
  agents: PairAgent[];
  /** False for controls: any finding is a false positive. */
  expectClash: boolean;
  /** Per-agent environment (PATH to the Python venv, PYTHONPATH to the agent's checkout). */
  env: (cwd: string) => Record<string, string>;
  extraTools: string[];
  grade: (g: GradeInput) => Promise<PairGrade>;
};

/** No `cat`/`ls`, as in ALLOWED_TOOLS: shell-written files skip the edit hooks Little Brother watches. */
export const PYTHON_TOOLS = ["Bash(python *)", "Bash(python3 *)", "Bash(pytest *)", "Bash(cd *)"];
