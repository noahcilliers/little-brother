import type { Metadata } from "next";
import "@/app/landing.css";
import "./start.css";
import { LandingNav } from "@/components/landing/landing-nav";
import { StartClient } from "@/components/start/start-client";
import { signedIn, siteOrigin } from "@/lib/server-site";

export const metadata: Metadata = { title: "Get started · Little Brother" };

export default async function StartPage() {
  const [origin, authed] = await Promise.all([siteOrigin(), signedIn()]);
  return (
    <div className="lp">
      <LandingNav signedIn={authed} links={false} />
      <main className="wrap start">
        <div className="tiles start-head">
          <div className="tile">
            <span className="label">Get started</span>
            <h1 className="start-title">Connect your team in four steps</h1>
            <p className="sub">
              Sign in, set up the team, connect each laptop, and watch the first events arrive. Every teammate
              does steps 1, 3 and 4 on their own machine.
            </p>
          </div>
        </div>
        <StartClient origin={origin} />
      </main>
    </div>
  );
}
