"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Place } from "@/lib/use-current-room";
import { Icon, type IconName } from "../ui/icon";

type Item = { id: string; label: string; icon: IconName; href: (room: string) => string; hostOnly?: boolean };

const ITEMS: Item[] = [
  { id: "sessions", label: "Sessions", icon: "sessions", href: (r) => `/app/rooms/${r}` },
  { id: "logs", label: "Logs", icon: "logs", href: (r) => `/app/rooms/${r}/logs`, hostOnly: true },
  { id: "members", label: "Members", icon: "members", href: (r) => `/app/rooms/${r}/members` },
  { id: "laptops", label: "Laptops", icon: "laptop", href: (r) => `/app/rooms/${r}/laptops` },
  { id: "settings", label: "Settings", icon: "settings", href: (r) => `/app/rooms/${r}/settings` },
];
const SESSIONS_SHOWN = 6;

/** The room's sections, with its open sessions listed under Sessions. */
export function SidebarNav({ place, collapsed }: { place: Place; collapsed: boolean }) {
  const room = useQuery(api.rooms.get, place.roomId ? { roomId: place.roomId } : "skip");
  const requests = useQuery(api.roomAdmin.requests, place.roomId ? { roomId: place.roomId } : "skip");
  const open = (room?.sessions ?? []).filter((s) => s.endedAt === null);
  const roomId = place.roomId;
  return (
    <nav className="side-nav" aria-label="Room">
      {ITEMS.filter((i) => !i.hostOnly || room?.isOwner).map((i) => {
        const here = place.section === i.id && !(i.id === "sessions" && place.sessionId);
        const badge = i.id === "members" && requests && requests.length > 0 ? requests.length : null;
        return (
          <div key={i.id}>
            {roomId ? (
              <Link
                className="side-link"
                href={i.href(roomId)}
                aria-current={here ? "page" : undefined}
                title={collapsed ? i.label : undefined}
              >
                <Icon name={i.icon} />
                <span className="side-label">{i.label}</span>
                {badge ? <span className="side-badge">{badge}</span> : null}
              </Link>
            ) : (
              <span className="side-link off">
                <Icon name={i.icon} />
                <span className="side-label">{i.label}</span>
              </span>
            )}
            {i.id === "sessions" && !collapsed && open.length > 0 ? (
              <ul className="side-sessions">
                {open.slice(0, SESSIONS_SHOWN).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/app/sessions/${s.id}`}
                      aria-current={place.sessionId === s.id ? "page" : undefined}
                      title={s.name}
                    >
                      <span className={s.live > 0 ? "dot dot-ok dot-pulse" : "dot"} aria-hidden="true" />
                      <span className="side-label">{s.name}</span>
                    </Link>
                  </li>
                ))}
                {open.length > SESSIONS_SHOWN && roomId ? (
                  <li>
                    <Link className="side-more" href={`/app/rooms/${roomId}`}>
                      View all {open.length}
                    </Link>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
