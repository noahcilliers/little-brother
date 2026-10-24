import Link from "next/link";
import type { RoomSession } from "@/lib/api";
import { ago } from "@/lib/format";

const MAX_PEOPLE = 4;

/** One session in a room: name and code, who has joined, and whether anything is live. */
export function SessionRow({ s }: { s: RoomSession }) {
  const ended = s.endedAt !== null;
  const extra = s.people.length - MAX_PEOPLE;
  return (
    <Link className={ended ? "row-link ended" : "row-link"} href={`/app/sessions/${s.id}`}>
      <span className={s.live > 0 ? "live-dot on" : "live-dot"} aria-hidden="true" />
      <span className="row-main">
        <b title={s.name}>{s.name}</b>
        <small>
          <code>{s.code}</code>
          {s.people.length > 0
            ? ` · ${s.people
                .slice(0, MAX_PEOPLE)
                .map((p) => `@${p}`)
                .join(" ")}${extra > 0 ? ` +${extra}` : ""}`
            : " · nobody joined yet"}
        </small>
      </span>
      <span className="row-meta">
        {ended ? (
          <span className="row-tag">ended</span>
        ) : s.live > 0 ? (
          <span className="row-tag on">{s.live} live</span>
        ) : null}
        <small>{s.lastActive ? ago(s.lastActive) : `created ${ago(s.createdAt)}`}</small>
      </span>
      <span className="row-go" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
