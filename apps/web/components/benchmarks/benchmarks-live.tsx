"use client";

import "./benchmarks.css";
import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { PublicConvex } from "@/components/public-convex";
import { api } from "@/lib/api";
import { BatchCard } from "./batch-card";
import { RunFeed } from "./run-feed";

/** Relative times ("3 min ago") keep moving between Convex updates. */
function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function Board() {
  const board = useQuery(api.evalLive.board, {});
  const now = useNow();
  if (board === undefined) return <p className="bm-note">Connecting to Convex…</p>;
  if (!board.batches.length && !board.feed.length)
    return <p className="bm-note">No benchmark runs yet. They appear here as the harness grades them.</p>;
  return (
    <div className="bm-grid">
      <div className="bm-batches">
        {board.batches.map((b) => (
          <BatchCard key={b.batch} batch={b} now={now} />
        ))}
      </div>
      <RunFeed runs={board.feed} now={now} />
    </div>
  );
}

/** Every eval batch, live from Convex: progress while it runs, per-arm aggregates, and each run as it lands. */
export function BenchmarksLive() {
  return (
    <PublicConvex
      fallback={<p className="bm-note">Loading live results…</p>}
      failed={<p className="bm-note">Live results are unavailable right now.</p>}
    >
      <Board />
    </PublicConvex>
  );
}
