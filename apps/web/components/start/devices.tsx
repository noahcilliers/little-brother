"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";

/** The member's laptops; revoking stops that laptop's connector token immediately. */
export function Devices() {
  const devices = useQuery(api.devices.list);
  const revoke = useMutation(api.devices.revoke);
  if (!devices || devices.length === 0) return null;
  return (
    <div className="devices">
      <span className="label">Your laptops</span>
      <ul>
        {devices.map((d) => (
          <li key={d.id}>
            <b>{d.machine ?? d.label}</b>
            <span>
              {d.status === "active" && d.joinedAt ? `connected ${ago(d.joinedAt)}` : "token not used yet"}
            </span>
            <button type="button" className="link" onClick={() => void revoke({ id: d.id })}>
              Revoke
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
