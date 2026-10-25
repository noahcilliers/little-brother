import type { Metadata } from "next";
import "@/app/landing.css";
import { BenchmarksLive } from "@/components/benchmarks/benchmarks-live";
import { LandingNav } from "@/components/landing/landing-nav";

export const metadata: Metadata = {
  title: "Live benchmarks · Little Brother",
  description:
    "Eval batches streaming into Convex as they run: Claude Code agent pairs with Little Brother off and on, graded by git and the tests.",
};

export default function BenchmarksPage() {
  return (
    <div className="lp">
      <LandingNav signedIn={false} links={false} />
      <main className="wrap bm">
        <header className="bm-head">
          <span className="label">Benchmarks · live</span>
          <h1>Eval runs, as they are graded</h1>
          <p>
            Pairs of Claude Code agents get clashing tasks on the same repo, once with Little Brother off and
            once on. The harness grades each run from git and the tests and streams it straight into Convex,
            so this page fills in while a batch runs. Rate-limited runs are shown as voided and left out of
            every number.
          </p>
        </header>
        <BenchmarksLive />
        <footer>
          <a href="/#results">← results</a>
          <a href="/report">technical report</a>
        </footer>
      </main>
    </div>
  );
}
