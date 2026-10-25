import "@/app/landing.css";
import { Film } from "../film/film";
import { Features } from "./features";
import { Hero } from "./hero";
import { LandingNav } from "./landing-nav";
import { Results } from "./results";
import { Stack } from "./stack";
import { EvalTimelapse } from "./timelapse/eval-timelapse";

export function LandingPage({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  return (
    <div className="lp">
      <LandingNav signedIn={signedIn} />
      <main className="wrap" id="top">
        <Hero origin={origin} />
        <Film />
        <Results />
        <EvalTimelapse />
        <Features />
        <Stack />
        <footer>
          <span>little brother · Cal Hacks 13.0 · Ash, Noah, Joshua</span>
          <span>
            <a href="/report">Technical report</a> · <a href="/benchmarks">Live benchmarks</a> ·{" "}
            <a href="https://github.com/noahcilliers/little-brother">GitHub</a>
          </span>
        </footer>
      </main>
    </div>
  );
}
