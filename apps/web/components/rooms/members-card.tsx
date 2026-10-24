import type { RoomMember } from "@/lib/api";
import { Avatar } from "../account/avatar";

/** Who is in the room. */
export function MembersCard({ members }: { members: RoomMember[] }) {
  return (
    <section className="panel">
      <div className="panel-h">
        Members <span className="count-pill">{members.length}</span>
      </div>
      <ul className="people">
        {members.map((m) => (
          <li key={m.id}>
            <Avatar src={m.avatarUrl ?? undefined} name={m.handle} size={24} />
            <span className="row-main">
              <b title={m.name}>{m.name}</b>
              <small>@{m.handle}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
