import { QrCode } from "@/components/share/qr-code";
import { prog } from "./film-clock";
import { rise } from "./film-fx";

const SITE = "https://little-brother-gules.vercel.app";
const T0 = 70.3;

/** Scene 7: the line, and a QR styled like the board's Share dialog. */
export function SceneClose({ s }: { s: number }) {
  const card = prog(s, T0 + 0.5, 0.5);
  return (
    <div className="fx-close">
      <div className="fx-close-copy">
        <span className="fh-mask">
          <span className="fx-brand" style={rise(prog(s, T0, 0.5))}>
            little brother<i>▍</i>
          </span>
        </span>
        <span className="fh-mask">
          <span className="fx-claim" style={rise(prog(s, T0 + 0.2, 0.5))}>
            Your agents, finally on the same page.
          </span>
        </span>
        <span className="fx-close-meta" style={{ opacity: prog(s, T0 + 0.8, 0.4) }}>
          Claude Code plugin · hooks + MCP · works across laptops and accounts
        </span>
      </div>
      <section
        className="fx-qr-card"
        style={{ opacity: card, transform: `translateY(${(1 - card) * 24}px)` }}
      >
        <h3>Scan to join a live session</h3>
        <p>Sign in with GitHub and land on the board.</p>
        <QrCode text={SITE} label="little-brother-gules.vercel.app" />
        <code>little-brother-gules.vercel.app</code>
      </section>
    </div>
  );
}
