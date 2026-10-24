"use client";

import Link from "next/link";
import type { Place } from "@/lib/use-current-room";
import { AccountFooter } from "./account-footer";
import { RoomSwitcher } from "./room-switcher";
import { SidebarNav } from "./sidebar-nav";

type Props = { place: Place; collapsed: boolean; onCollapse?: () => void };

/** The fixed left rail: wordmark, room switcher, the room's sections, and the account. */
export function Sidebar({ place, collapsed, onCollapse }: Props) {
  return (
    <aside className={collapsed ? "sidebar collapsed" : "sidebar"}>
      <div className="side-top">
        <Link className="wordmark" href="/app" aria-label="Little Brother home">
          {collapsed ? "lb" : "little brother"}
          <i aria-hidden="true">▍</i>
        </Link>
        <RoomSwitcher roomId={place.roomId} collapsed={collapsed} />
      </div>
      <SidebarNav place={place} collapsed={collapsed} />
      <AccountFooter collapsed={collapsed} onCollapse={onCollapse} />
    </aside>
  );
}
