import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATASETS, ghApi } from "./common";

// Every GitHub response is cached on disk, so re-runs and converters never spend the rate limit twice.
// Search has its own limit (30/min), so search calls are paced.

const CACHE = join(DATASETS, "github", "api");
const SEARCH_GAP_MS = 2300;
let lastSearch = 0;
export const stats = { hits: 0, calls: 0, failures: 0 };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyOf = (path: string) => join(CACHE, `${createHash("sha1").update(path).digest("hex")}.json`);

export function cached<T>(path: string): T | null {
  const file = keyOf(path);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as { body: T }).body : null;
}

/** GET a REST path (with its query string) through `gh api`; null on 404/422 or any failure. */
export async function gh<T>(path: string): Promise<T | null> {
  const file = keyOf(path);
  if (existsSync(file)) {
    stats.hits += 1;
    return (JSON.parse(readFileSync(file, "utf8")) as { body: T | null }).body;
  }
  if (path.startsWith("search/")) {
    const wait = lastSearch + SEARCH_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastSearch = Date.now();
  }
  stats.calls += 1;
  let body: T | null = null;
  try {
    body = JSON.parse(await ghApi(path)) as T;
  } catch (e) {
    stats.failures += 1;
    const text = String(e);
    // Rate limits are transient: don't cache them as "missing".
    if (/rate limit|403|429/i.test(text)) return null;
  }
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, JSON.stringify({ path, body }));
  return body;
}

export type Pr = {
  number: number;
  title: string;
  body: string | null;
  state: string;
  merged_at: string | null;
  created_at: string;
  closed_at: string | null;
  base: { ref: string };
  head: { ref: string };
  labels?: { name: string }[];
};
export type PrFile = { filename: string; status: string; patch?: string; previous_filename?: string };
export type SearchItem = { number: number; title: string; body: string | null; pull_request?: unknown };

export const pr = (repo: string, n: number) => gh<Pr>(`repos/${repo}/pulls/${n}`);
export const prFiles = (repo: string, n: number) =>
  gh<PrFile[]>(`repos/${repo}/pulls/${n}/files?per_page=100`);
export const comments = (repo: string, n: number) =>
  gh<{ body: string }[]>(`repos/${repo}/issues/${n}/comments?per_page=100`);

export async function search(q: string, page = 1): Promise<SearchItem[]> {
  const res = await gh<{ items: SearchItem[] }>(
    `search/issues?q=${encodeURIComponent(q)}&per_page=100&page=${page}`,
  );
  return res?.items ?? [];
}
