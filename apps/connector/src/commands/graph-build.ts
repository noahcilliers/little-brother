import { buildGraphFor } from "../graph/build";
import { releaseBuild, writeGraph } from "../graph/cache";

/** Background child spawned by SessionStart/Stop on a cache miss; prints stats when run by hand. */
export async function graphBuildCommand(o: { repo: string; head: string; print?: boolean }): Promise<void> {
  const started = performance.now();
  try {
    const graph = await buildGraphFor(o.repo, o.head);
    writeGraph(o.repo, graph);
    if (o.print) {
      const edges = graph.edges.reduce((n, [, ids]) => n + ids.length, 0);
      const bytes = JSON.stringify(graph).length;
      const ms = Math.round(performance.now() - started);
      console.log(
        `keys=${graph.edges.length} edges=${edges} importers=${graph.files.length} bytes=${bytes} ms=${ms}`,
      );
    }
  } finally {
    releaseBuild(o.repo, o.head);
  }
}
