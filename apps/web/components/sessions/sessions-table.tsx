import Link from "next/link";
import type { Room, RoomSession } from "@/lib/api";
import { ago } from "@/lib/format";
import { CodeChip } from "../shell/code-chip";
import { Badge, Dot } from "../ui/badge";
import { PeopleStack } from "./people-stack";

function Status({ s }: { s: RoomSession }) {
  if (s.endedAt !== null) return <Badge>Ended</Badge>;
  if (s.live > 0)
    return (
      <span className="status">
        <Dot tone="ok" pulse /> {s.live} live
      </span>
    );
  return (
    <span className="status muted">
      <Dot /> Idle
    </span>
  );
}

/** Open sessions first, then ended ones; each row opens the session's board. */
export function SessionsTable({ room }: { room: Room }) {
  const rows = [...room.sessions].sort((a, b) => Number(a.endedAt !== null) - Number(b.endedAt !== null));
  return (
    <div className="data-table sessions-table">
      <div className="dt-head" aria-hidden="true">
        <span>Name</span>
        <span>Code</span>
        <span>People</span>
        <span>Status</span>
        <span className="right">Last active</span>
      </div>
      <ul className="dt-body">
        {rows.map((s) => (
          <li key={s.id} className={s.endedAt !== null ? "dt-row ended" : "dt-row"}>
            {/* The name link stretches over the whole row; the code chip sits above it so it still copies. */}
            <Link className="cell-name stretch" href={`/app/sessions/${s.id}`} title={s.name}>
              {s.name}
            </Link>
            <span className="cell-code">
              <CodeChip code={s.code} />
            </span>
            <span className="cell-people">
              <PeopleStack handles={s.people} members={room.members} />
            </span>
            <span className="cell-status">
              <Status s={s} />
            </span>
            <span className="cell-time right muted">
              {s.lastActive ? ago(s.lastActive) : `created ${ago(s.createdAt)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
