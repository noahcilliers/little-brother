"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { Badge } from "../ui/badge";
import { Loading } from "../ui/empty";
import { Pane } from "../ui/pane";

const FALLBACK: Record<string, string> = {
  conflict: "Incompatible implementation of the same topic already exists",
  duplicate: "Same task already done or in progress by another agent",
  stale: "Follows a path already recorded as failed",
  normal: "No overlap",
};

export function EventTypesTable() {
  const rows = useQuery(api.dashboard.eventTypeCounts);
  return (
    <Pane title="event types" meta="live counts">
      {rows === undefined ? (
        <Loading what="event types" />
      ) : (
        <table className="ev">
          <colgroup>
            <col style={{ width: 100 }} />
            <col style={{ width: 84 }} />
            <col />
            <col style={{ width: 56 }} />
            <col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr>
              <th>type</th>
              <th>enforce</th>
              <th>meaning</th>
              <th>open</th>
              <th>total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>
                  <Badge kind={r.key} />
                </td>
                <td className="dim">{r.enforcement}</td>
                <td className="dim" title={r.description || FALLBACK[r.key]}>
                  {r.description || FALLBACK[r.key]}
                </td>
                <td>{r.open}</td>
                <td>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pane>
  );
}
