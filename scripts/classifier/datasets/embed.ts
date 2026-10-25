import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { geminiEmbedder } from "../../../packages/backend/convex/classify/adapters/gemini";
import { DATASETS } from "./common";

// Intent pairs are retrieved by the vector index in production, so their "similar intent (x)" reason is
// recomputed here with the same Gemini embedder the deployment uses (cached; texts are embedded once).
// Without a key it falls back to the lexical similarity the backend uses when no embedder is configured.

const CACHE = join(DATASETS, "embeddings", "gemini.jsonl");
const BACKEND = resolve(dirname(fileURLToPath(import.meta.url)), "../../../packages/backend");
const memo = new Map<string, number[]>();
const key = (t: string) => createHash("sha1").update(t).digest("hex");

function load(): void {
  if (memo.size || !existsSync(CACHE)) return;
  for (const l of readFileSync(CACHE, "utf8").split("\n")) {
    if (!l) continue;
    const { k, v } = JSON.parse(l) as { k: string; v: number[] };
    memo.set(k, v);
  }
}

/** GEMINI_API_KEY from the environment, else from the local deployment's env (never printed). */
export function geminiKey(): string | null {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const config = JSON.parse(readFileSync(join(BACKEND, ".convex/local/default/config.json"), "utf8")) as {
      deploymentName: string;
    };
    const out = execFileSync("npx", ["convex", "env", "get", "GEMINI_API_KEY"], {
      cwd: BACKEND,
      env: { ...process.env, CONVEX_DEPLOYMENT: `anonymous:${config.deploymentName}` },
    })
      .toString()
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

/** Embed every text not yet cached, in batches. */
export async function embedAll(texts: string[], apiKey: string | null): Promise<void> {
  load();
  if (!apiKey) return;
  const todo = [...new Set(texts)].filter((t) => !memo.has(key(t)));
  const embedder = geminiEmbedder(apiKey);
  mkdirSync(dirname(CACHE), { recursive: true });
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    const vectors = await embedder.embed(batch).catch(() => null);
    if (!vectors) continue;
    batch.forEach((t, j) => {
      const v = vectors[j];
      if (!v) return;
      memo.set(key(t), v);
      appendFileSync(CACHE, `${JSON.stringify({ k: key(t), v })}\n`);
    });
  }
}

export function cosine(a: string, b: string): number | null {
  load();
  const x = memo.get(key(a));
  const y = memo.get(key(b));
  if (!x || !y) return null;
  let dot = 0;
  let nx = 0;
  let ny = 0;
  for (let i = 0; i < x.length; i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    dot += p * q;
    nx += p * p;
    ny += q * q;
  }
  return nx && ny ? dot / Math.sqrt(nx * ny) : null;
}
