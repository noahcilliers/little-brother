import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { QrCode } from "@/components/share/qr-code";
import { lastBefore, prog } from "./film-clock";
import { BEAT } from "./film-timeline";
import { Phone, Tap } from "./mockups";
import { PhoneFeed } from "./phone-feed";

export const JOIN_URL = "https://little-brother-gules.vercel.app/r/k7f2qx";
type Frame = { x: number; y: number; w: number; h: number };

function Scan({ s }: { s: number }) {
  const lock = prog(s, BEAT.scan + 0.5, 0.4);
  return (
    <div className="p-camera">
      <div
        className="p-viewfinder"
        style={{ transform: `scale(${1.25 - lock * 0.25}) rotate(${(1 - lock) * -6}deg)` }}
      >
        <QrCode text={JOIN_URL} label="Join code" />
      </div>
      {lock >= 1 ? <span className="p-found">little-brother-gules.vercel.app/r/k7f2qx</span> : null}
    </div>
  );
}

function Join({ s }: { s: number }) {
  const asked = s >= BEAT.askTap + 0.1;
  return (
    <div className="p-card">
      <small>Invite</small>
      <h4>Join lb-demo-shop</h4>
      <p>checkout sprint · hosted by Ash</p>
      {asked ? (
        <p className="p-wait">
          <i className="p-pulse" /> Waiting for the host to let you in…
        </p>
      ) : (
        <span className="p-btn solid">Ask to join</span>
      )}
      <Tap x={110} y={150} p={prog(s, BEAT.askTap, 0.45)} />
    </div>
  );
}

function Decide({ s }: { s: number }) {
  const done = s >= BEAT.phoneTap + 0.15;
  return (
    <div className="p-card p-decide">
      <small>
        <InlineIcon name={CATCH_ICON.conflict} color="var(--hot)" size={12} /> Needs your decision
      </small>
      <h4>auth.mechanism</h4>
      <div className="p-side">
        <b>noah · JWT bearer</b>
        <code>jwt.sign({"{ sub: user.id }"})</code>
      </div>
      <div className="p-side">
        <b>ash · cookie sessions</b>
        <code>req.session.userId</code>
      </div>
      {done ? (
        <p className="p-done">Kept JWT bearer · delivered to Ash's session</p>
      ) : (
        <>
          <span className={s >= BEAT.phoneTap - 0.1 ? "p-btn solid pressed" : "p-btn solid"}>
            Keep JWT bearer
          </span>
          <span className="p-btn">Keep cookie sessions</span>
        </>
      )}
      <Tap x={100} y={228} p={prog(s, BEAT.phoneTap, 0.45)} />
    </div>
  );
}

const SCREENS: [s: number, app: string, sub: string][] = [
  [0, "Claude", "Noah"],
  [BEAT.scan, "Camera", "scan to join"],
  [BEAT.joinCard, "little brother", "in browser"],
];

/** Noah's phone: scans the share QR, waits to be admitted, follows the board, and settles the conflict. */
export function PhoneA({ s, ...f }: { s: number } & Frame) {
  const [, app, sub] = lastBefore(SCREENS, s) ?? [0, "Claude", ""];
  let body = (
    <div className="p-list">
      <small>Recents</small>
      <span className="p-row">auth workflow · Claude Code</span>
      <span className="p-row">lb-demo-shop notes</span>
    </div>
  );
  if (s >= BEAT.scan && s < BEAT.joinCard) body = <Scan s={s} />;
  else if (s >= BEAT.joinCard && s < BEAT.noahIn) body = <Join s={s} />;
  else if (s >= BEAT.phoneDecision && s < BEAT.popupClose + 0.4) body = <Decide s={s} />;
  else if (s >= BEAT.noahIn) body = <PhoneFeed s={s} />;
  return (
    <Phone app={app} sub={sub} {...f}>
      <div key={app} className="p-screen">
        {body}
      </div>
    </Phone>
  );
}
