import "@/app/landing.css";
import { Film } from "../film/film";
import { Connect } from "./connect";
import { Features } from "./features";
import { Hero } from "./hero";
import { HowStrip } from "./how-strip";
import { LandingNav } from "./landing-nav";
import { Results } from "./results";
import { Stack } from "./stack";
import { Why } from "./why";

export function LandingPage({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  return (
    <div className="lp">
      <LandingNav signedIn={signedIn} />
      <main className="wrap" id="top">
        <Hero origin={origin} />
        <Film />
        <Results />
        <Features />
        <HowStrip />
        <Why />
        <Stack />
        <Connect origin={origin} />
        <footer>
          <span>little brother · Cal Hacks 13.0 · Ash, Noah, Joshua</span>
          <span>
            <a href="/report">Technical report</a> · Claude Code hooks · MCP · Convex · Gemini · Claude
          </span>
        </footer>
      </main>
    </div>
  );
}
