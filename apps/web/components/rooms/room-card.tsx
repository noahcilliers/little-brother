import Link from "next/link";
import type { RoomSummary } from "@/lib/api";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One row in the rooms list: name, size, and a pulse when any Claude session in it is live. */
export function RoomCard({ room }: { room: RoomSummary }) {
  return (
    <Link className="row-link" href={`/app/rooms/${room.id}`}>
      <span className={room.live > 0 ? "live-dot on" : "live-dot"} aria-hidden="true" />
      <span className="row-main">
        <b title={room.name}>{room.name}</b>
        <small>
          {plural(room.members, "member")} · {plural(room.sessions, "session")}
          {room.isOwner ? " · owner" : ""}
        </small>
      </span>
      <span className={room.live > 0 ? "row-tag on" : "row-tag"}>
        {room.live > 0 ? `${room.live} live` : "idle"}
      </span>
      <span className="row-go" aria-hidden="true">
        →
      </span>
    </Link>
  );
}
