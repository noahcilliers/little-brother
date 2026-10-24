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
            <h1 className="start-title">Get set up in three steps</h1>
            <p className="sub">
              Sign in, connect this laptop, then create a room or join one from an invite. Inside a room, each
              session has a join code you run in Claude Code.
            </p>
          </div>
        </div>
        <StartClient origin={origin} />
      </main>
    </div>
  );
}
