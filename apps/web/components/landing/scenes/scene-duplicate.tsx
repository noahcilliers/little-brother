import "./scene-duplicate.css";
import "./scene-duplicate-motion.css";
import { Av, MiniTerm } from "../mini";

export function SceneDuplicate() {
  return (
    <div className="sc sc-dup">
      <div className="dup-lanes">
        <div className="lane">
          <Av who="noah" />
          <b>noah</b>
          <span className="dbar b1">
            <i className="live" />
            users table · db/schema/users.ts
          </span>
        </div>
        <div className="lane">
          <Av who="ash" />
          <b>ash</b>
          <span className="dbar b2">add a users table</span>
        </div>
        <svg className="dup-arrow" viewBox="0 0 44 72" fill="none" aria-hidden="true">
          <path className="dash" d="M2 60 C 38 60, 38 12, 8 12" />
          <path className="head" d="M14 6 L6 12 L14 18" />
        </svg>
        <span className="dup-tag">duplicate · 0.94</span>
      </div>
      <div className="dup-right">
        <MiniTerm title="ash@mbp — claude" className="dup-term">
          <p className="d1">
            <b>●</b> Write(db/schema/users.ts)
          </p>
          <p className="d2">
            <b className="acc">⎿ ✕ denied by little-brother</b>
          </p>
          <p className="d3">
            noah's agent already owns db.users. Import it and move on to the checkout form.
          </p>
        </MiniTerm>
        <span className="saved-chip">saved ~6k tokens</span>
      </div>
    </div>
  );
}
