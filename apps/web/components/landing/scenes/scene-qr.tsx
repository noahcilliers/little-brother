import "./scene-qr.css";
import "./scene-qr-motion.css";
import { QrCode } from "@/components/share/qr-code";
import { Av } from "../mini";

const DEMO_QR = "little brother · session k7f2qx";

/** The host's Share · QR panel on the left, a phone scanning it on the right, then the waiting room. */
export function SceneQr() {
  return (
    <div className="sc sc-qr">
      <div className="qr-host">
        <span className="cf-cap">share · qr</span>
        <QrCode text={DEMO_QR} label="Example session QR code" />
        <div className="qr-wait">
          <Av who="joshua" />
          <span>
            <b>joshua</b>
            <small>waiting to join</small>
          </span>
          <span className="adm">Admit</span>
        </div>
      </div>
      <div className="qr-phone">
        <div className="ph s1">
          <span className="vf">
            <QrCode text={DEMO_QR} label="Example session QR code" />
            <i className="scan" />
          </span>
          <small>scanning…</small>
        </div>
        <div className="ph s2">
          <span className="dots">
            <i />
            <i />
            <i />
          </span>
          <b>Waiting room</b>
          <small>the host will let you in</small>
        </div>
        <div className="ph s3">
          <b className="ok-mark">✓</b>
          <b>You're in</b>
          <small>checkout sprint</small>
          <span className="ph-lanes">
            <i />
            <i />
            <i />
          </span>
        </div>
      </div>
    </div>
  );
}
