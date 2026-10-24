"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { type RoomDialog, RoomDialogs } from "../rooms/room-dialogs";
import { Icon } from "../ui/icon";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "../ui/menu";

const initial = (name: string) => name.trim().slice(0, 1).toUpperCase() || "·";

/** Top of the sidebar: which room you're in, and a dropdown to switch, create or join one. */
export function RoomSwitcher({ roomId, collapsed }: { roomId: string | null; collapsed: boolean }) {
  const rooms = useQuery(api.rooms.mine);
  const room = useQuery(api.rooms.get, roomId ? { roomId } : "skip");
  const [dialog, setDialog] = useState<RoomDialog>(null);
  const name = room?.name ?? (roomId ? "…" : "No room");
  return (
    <>
      <Menu
        label="Switch room"
        triggerClass="room-switch"
        wide
        trigger={
          <>
            <span className="room-mark" aria-hidden="true">
              {initial(name)}
            </span>
            {collapsed ? null : (
              <>
                <span className="room-name" title={name}>
                  {name}
                </span>
                <Icon name="updown" size={14} className="room-caret" />
              </>
            )}
          </>
        }
      >
        <MenuLabel>Rooms</MenuLabel>
        {(rooms ?? []).map((r) => (
          <MenuItem key={r.id} href={`/app/rooms/${r.id}`} checked={r.id === roomId}>
            <span className="room-mark sm" aria-hidden="true">
              {initial(r.name)}
            </span>
            {r.name}
          </MenuItem>
        ))}
        {rooms && rooms.length > 0 ? <MenuSeparator /> : null}
        <MenuItem icon="plus" onSelect={() => setDialog("create")}>
          Create room
        </MenuItem>
        <MenuItem icon="login" onSelect={() => setDialog("join")}>
          Join room
        </MenuItem>
      </Menu>
      <RoomDialogs open={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
