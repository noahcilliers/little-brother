import "./scene-conflict.css";
import "./scene-conflict-motion.css";

const GIT = [
  ["g1", "noah/cookie-session", "✓ tests"],
  ["g2", "ash/jwt-bearer", "✓ tests"],
  ["g3", "merge → main", "✓ clean"],
  ["g4 red", "npm test", "✕ 401 /me"],
] as const;

/** Left: what git shows (a clean merge, then a red test). Right: the decision Little Brother asks for first. */
export function SceneConflict() {
  return (
    <div className="sc sc-conf">
      <div className="cf-git">
        <span className="cf-cap">with git</span>
        <div className="cf-log">
          {GIT.map(([cls, what, res]) => (
            <p key={cls} className={cls}>
              <span>
                <i />
                {what}
              </span>
              <b>{res}</b>
            </p>
          ))}
        </div>
      </div>
      <div className="cf-lb">
        <span className="cf-cap">with little brother</span>
        <div className="dec">
          <div className="dec-h">
            <span className="vt conflict">conflict</span>
            <b>auth.mech</b>
            <small>edits paused</small>
          </div>
          <div className="dec-diff">
            <div>
              <small>noah · cookie-session</small>
              <code className="del">- headers.authorization</code>
              <code className="add">+ res.cookie("sid", t)</code>
            </div>
            <div>
              <small>ash · jwt-bearer</small>
              <code className="add">{"+ Bearer <jwt>"}</code>
              <code className="add">+ verifyJwt(token)</code>
            </div>
          </div>
          <div className="dec-act">
            <span className="opt">Keep cookie</span>
            <span className="opt pick">Keep JWT bearer</span>
            <svg className="cursor" viewBox="0 0 16 20" aria-hidden="true">
              <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" />
            </svg>
          </div>
          <p className="dec-done">resolved · noah's agent gets the decision pushed</p>
        </div>
      </div>
    </div>
  );
}
