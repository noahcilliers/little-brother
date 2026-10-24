import { installCmd } from "./commands";
import { CopyCmd } from "./copy-cmd";

export function Hero({ origin }: { origin: string }) {
  return (
    <div className="tiles hero">
      <div className="tile lead">
        <div className="lead-main">
          <span className="label">Coordination for teams of coding agents</span>
          <h1>
            <span>Your agents can't see each other.</span>
            <span className="m">little brother can_</span>
          </h1>
        </div>
        <div className="lead-side">
          <p className="sub">
            Each teammate runs Claude Code on their own machine. Little Brother watches every edit and command
            across all of them, and stops duplicate work, repeated failures and conflicting changes while the
            agents are still working.
          </p>
          <div className="cta">
            <CopyCmd text={installCmd(origin)} />
            <a className="btn inv" href="/start">
              Get started
            </a>
            <a className="btn" href="#features">
              See features
            </a>
          </div>
          <p className="meta">Claude Code hooks + MCP · separate machines and accounts · Cal Hacks 13.0</p>
        </div>
      </div>
    </div>
  );
}
