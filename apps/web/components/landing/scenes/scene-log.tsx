import "./scene-log.css";

const ROWS = [
  ["10:42:07", "duplicate", "tier-0 rule", "1.00", "3 ms"],
  ["10:42:09", "normal", "similarity", "0.18", "38 ms"],
  ["10:42:12", "stale", "gemini judge", "0.91", "412 ms"],
  ["10:42:15", "conflict", "gemini judge", "0.87", "388 ms"],
  ["10:42:18", "duplicate", "stored verdict", "0.94", "2 ms"],
] as const;

const SERVER = [
  "POST /hook/PreToolUse 200 · 18 ms",
  "tier0 db/schema/users.ts → duplicate",
  "POST /hook/PostToolUse 200 · 11 ms",
  "scheduler classify.run pair e81·c02",
  "embed gemini-embedding-001 · 768d · 96 ms",
  "judge gemini flash-lite → stale 0.91",
  "inbox push → noah · channel",
  "POST /session/attach 202 · waiting",
  "POST /mcp/inbox 200 · 9 ms",
  "decision auth.mech = jwt-bearer · label",
];

/** Classifier rows arrive one by one while the host's server log streams beside them. */
export function SceneLog() {
  return (
    <div className="sc sc-log">
      <div className="lg-pane">
        <div className="lg-h">
          <span className="cf-cap">classifier log</span>
          <span className="lg-cols">
            <span className="c-time">time</span>
            <span>relation</span>
            <span>decided by</span>
            <span>conf</span>
            <span>ms</span>
          </span>
        </div>
        {ROWS.map(([time, rel, by, conf, ms], i) => (
          <p key={time} className={`lg-row r${i}`}>
            <span className="c-time">{time}</span>
            <span>
              <span className={`vt ${rel}`}>{rel}</span>
            </span>
            <span>{by}</span>
            <span>{conf}</span>
            <span>{ms}</span>
          </p>
        ))}
        <p className="lg-why">↳ both agents write db/schema/users.ts within 4 min · same symbol db.users</p>
      </div>
      <div className="lg-pane lg-server">
        <span className="cf-cap">server log · host</span>
        <div className="lg-stream">
          <div className="lg-roll">
            {[...SERVER, ...SERVER].map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the list is doubled for a seamless loop, so text repeats
              <code key={i}>{line}</code>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
