import { installCmd } from "./commands";
import { CopyCmd } from "./copy-cmd";

export function Hero({ origin }: { origin: string }) {
  return (
    <div className="tiles hero">
      <div className="tile lead">
        <h1>
          <span>Your agents can't see each other.</span>
          <span className="m">little brother can_</span>
        </h1>
        <div className="lead-side">
          <p className="sub">
            It watches every teammate's Claude Code session and stops duplicate work, repeated failures and
            conflicting changes as they happen.
          </p>
          <div className="cta">
            <CopyCmd text={installCmd(origin)} />
            <a className="btn inv" href="/login">
              Get started
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
