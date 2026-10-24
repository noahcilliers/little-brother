import type { RoomMember } from "@/lib/api";
import { Avatar } from "../account/avatar";

const SHOWN = 4;

/** Overlapping avatars for the handles in a session, with +N past four. */
export function PeopleStack({ handles, members }: { handles: string[]; members: RoomMember[] }) {
  if (handles.length === 0) return <span className="muted">—</span>;
  const avatar = new Map(members.map((m) => [m.handle, m.avatarUrl ?? undefined]));
  const extra = handles.length - SHOWN;
  return (
    <span className="people-stack" title={handles.map((h) => `@${h}`).join(", ")}>
      {handles.slice(0, SHOWN).map((h) => (
        <Avatar key={h} src={avatar.get(h)} name={h} size={22} />
      ))}
      {extra > 0 ? <span className="people-more">+{extra}</span> : null}
    </span>
  );
}
