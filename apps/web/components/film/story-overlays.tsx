import { QrCode } from "@/components/share/qr-code";
import { prog, window01 } from "./film-clock";
import { BEAT } from "./film-timeline";
import { JOIN_URL } from "./phone-a";

// The dashboard's own pop-ups, played on the film clock: Share · QR, the waiting room, and catch toasts.
// Same markup and wording as components/share, components/rooms and components/shell/toasts.

export function ShareOverlay({ s }: { s: number }) {
  const shown = window01(s, BEAT.qrShown, BEAT.waitCard, 0.3);
  if (shown <= 0) return null;
  return (
    <div className="f-scrim" style={{ opacity: shown }}>
      <div className="f-share" style={{ transform: `translateY(${(1 - shown) * 14}px)` }}>
        <header>
          <b>checkout sprint</b>
          <span>lb-demo-shop · code k7f2qx</span>
          <span className="f-btn">Present</span>
          <span className="f-btn">Esc</span>
        </header>
        <div className="f-share-grid">
          <section>
            <h3>Join from a phone</h3>
            <p>Scan, sign in with GitHub, and you're let in from the waiting room.</p>
            <QrCode text={JOIN_URL} label="Join from a phone" />
          </section>
          <section>
            <h3>Watch live</h3>
            <p>Read-only, no sign-in: the board and classifier log until you turn it off.</p>
            <QrCode text="https://little-brother-gules.vercel.app/watch/k7f2qx" label="Watch live" />
          </section>
        </div>
      </div>
    </div>
  );
}

export function WaitingCard({ s }: { s: number }) {
  const shown = window01(s, BEAT.waitCard, BEAT.noahIn + 0.3, 0.25);
  if (shown <= 0) return null;
  const admitted = s >= BEAT.admit + 0.1;
  return (
    <section className="f-waiting" style={{ opacity: shown, transform: `translateY(${(1 - shown) * 16}px)` }}>
      <div className="f-panel-h">
        Waiting to join <span className="f-pill">1</span>
      </div>
      <div className="f-wait-row">
        <span className="f-avatar">N</span>
        <span>
          <b>Noah</b>
          <small>@noah · via invite link</small>
        </span>
        <span className="f-btn">Deny</span>
        <span className={admitted ? "f-btn solid pressed" : "f-btn solid"}>
          {admitted ? "Admitted" : "Admit"}
        </span>
      </div>
    </section>
  );
}

type ToastRow = [from: number, to: number, tone: string, title: string, body: string, action: string];
// biome-ignore format: tabular scenario data
const TOASTS: ToastRow[] = [
  [BEAT.dup + 0.1, 24.2, "warn", "Duplicate caught · Joshua ↔ Noah", "Joshua's users table duplicates Noah's db.users. Denied before the write.", "Show"],
  [BEAT.stale + 0.1, 27.8, "warn", "Stale path avoided · Ash ↔ Noah", "Ash heads into Noah's failed CORS path. Warned with what worked.", "Show"],
  [BEAT.conflict + 0.2, BEAT.popup, "conflict", "Conflict · Ash ↔ Noah", "JWT bearer tokens vs cookie session on auth.mechanism.", "Decide"],
];

export function Toasts({ s }: { s: number }) {
  return (
    <ol className="f-toasts">
      {TOASTS.map(([from, to, tone, title, body, action]) => {
        const shown = window01(s, from, to, 0.25);
        if (shown <= 0) return null;
        const pressed = action === "Decide" && s >= BEAT.decideClick - 0.1;
        return (
          <li
            key={title}
            className={`f-toast tone-${tone}`}
            style={{ opacity: shown, transform: `translateX(${(1 - prog(s, from, 0.35)) * 40}px)` }}
          >
            <b>{title}</b>
            <p>{body}</p>
            <div>
              <span className={pressed ? "f-btn solid pressed" : "f-btn solid"}>{action}</span>
              <span className="f-x">×</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
