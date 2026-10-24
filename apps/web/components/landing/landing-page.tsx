import "@/app/landing.css";
import { Film } from "../film/film";
import { Catches } from "./catches";
import { Connect } from "./connect";
import { Hero } from "./hero";
import { How } from "./how";
import { LandingNav } from "./landing-nav";

export function LandingPage({ origin, signedIn }: { origin: string; signedIn: boolean }) {
  return (
    <div className="lp">
      <LandingNav signedIn={signedIn} />
      <main className="wrap" id="top">
        <Hero origin={origin} />
        <Film />
        <Catches />
        <How />
        <Connect origin={origin} />
        <footer>
          <span>little brother · Cal Hacks 13.0 · Ash, Noah, Joshua</span>
          <span>Claude Code hooks · MCP · Convex · Gemini</span>
        </footer>
      </main>
    </div>
  );
}
