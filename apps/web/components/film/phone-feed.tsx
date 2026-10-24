import { CATCH_ICON, InlineIcon } from "@/components/board/icons";
import { isRunning } from "@/lib/board-time";
import { CATCH_STYLE } from "@/lib/catch-style";
import { agentColor } from "@/lib/format";
import { boardAt, CATCHES } from "./film-board";
import { at } from "./film-clock";

const FEED: Record<string, string> = {
  c1: "Joshua stopped · users table exists",
  c2: "Ash steered to the Vite proxy",
  c3: "Conflict · auth.mechanism",
};

/** The board on a phone: who is working on what, and catches as they land. */
export function PhoneFeed({ s }: { s: number }) {
  const board = boardAt(s);
  const t = at(s);
  const caught = CATCHES.filter((c) => c.t <= t).reverse();
  return (
    <div className="p-feed">
      <div className="p-live">
        <i /> checkout sprint · live
      </div>
      {board.agents.map((a) => {
        const now = board.tasks.filter((k) => k.agentId === a.id && k.t0 <= t).pop();
        return (
          <div key={a.id} className="p-person">
            <i style={{ background: agentColor(a.color) }} />
            <b>{a.name}</b>
            <small>{now && isRunning(now, t) ? now.subject : "idle"}</small>
          </div>
        );
      })}
      {caught.length > 0 ? <small className="p-h">Catches</small> : null}
      {caught.map((c) => (
        <div key={c.id} className="p-catch">
          <InlineIcon name={CATCH_ICON[c.kind]} color={CATCH_STYLE[c.kind].color} size={12} />
          {FEED[c.id]}
        </div>
      ))}
    </div>
  );
}
