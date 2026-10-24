import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { prog, typed } from "./film-clock";
import { BEAT } from "./film-timeline";
import { Phone, Tap } from "./mockups";

type Frame = { x: number; y: number; w: number; h: number };
const PROMPT = "build the checkout backend: carts, orders, payments";
const CPS = PROMPT.length / (BEAT.remoteSend - BEAT.remoteType - 0.2);

// biome-ignore format: tabular scenario data
const STEPS: [s: number, text: string][] = [
  [15.8, "Cart and order models"], [16.4, "Write src/checkout/cart.ts"], [18.9, "npm test · 8 passed"],
  [20.4, "Write db/schema/users.ts"], [21.8, "Edit cart.ts · import User"], [23.9, "npm test · 9 passed"],
  [27.2, "Write src/checkout/payments.ts"], [31.6, "Write src/checkout/webhook.ts"],
];

/** Joshua's phone: Claude with Remote Control into his laptop's session; what he types runs in Terminal B. */
export function PhoneB({ s, ...f }: { s: number } & Frame) {
  const sent = s >= BEAT.remoteSend;
  const draft = !sent && s >= BEAT.remoteType ? typed(PROMPT, s, BEAT.remoteType, CPS) : "";
  const steps = STEPS.filter(([at]) => at <= s).slice(-4);
  return (
    <Phone app="Claude" sub="Remote Control" {...f}>
      <div className="p-screen">
        <div className="p-remote">
          <i /> joshua-mbp · ~/lb-demo-shop
        </div>
        {sent ? (
          <div className="p-bubble">{PROMPT}</div>
        ) : (
          <div className="p-empty">Connected to your laptop session</div>
        )}
        {steps.map(([at, text]) => (
          <div key={at} className="p-step">
            ⏺ {text}
          </div>
        ))}
        {s >= BEAT.dup ? (
          <div className="p-deny" style={{ opacity: prog(s, BEAT.dup, 0.3) }}>
            <InlineIcon name={CATCH_ICON.duplicate} color="var(--hot)" size={12} />
            <span>
              <b>little-brother denied a write</b>
              Noah already built db.users
            </span>
          </div>
        ) : null}
        {s >= 22.2 ? <span className="p-saved">saved ~6k tokens</span> : null}
        <div className={draft ? "p-input on" : "p-input"}>
          {draft || "Message your session…"}
          <span className="p-send">↑</span>
        </div>
        <Tap x={196} y={364} p={prog(s, BEAT.remoteSend - 0.15, 0.45)} />
      </div>
    </Phone>
  );
}
