"use client";

import { clsx } from "clsx";
import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { BranchStrip } from "../ui/branch-strip";
import { Empty, Loading } from "../ui/empty";
import { Pane } from "../ui/pane";

export function AgentsTable() {
  const rows = useQuery(api.dashboard.agents);
  return (
    <Pane title="agents" meta={rows ? `${rows.length} sessions` : "sessions"}>
      {rows === undefined ? (
        <Loading what="agents" />
      ) : rows.length === 0 ? (
        <Empty title="no sessions" sample={"$ lb join <invite-code> --as noah"}>
          One row per Claude Code session, on any machine or account.
        </Empty>
      ) : (
        <table className="ev">
          <colgroup>
            <col style={{ width: 76 }} />
            <col style={{ width: 240 }} />
            <col style={{ width: 92 }} />
            <col />
            <col style={{ width: 72 }} />
          </colgroup>
          <thead>
            <tr>
              <th>handle</th>
              <th>branch · base · git</th>
              <th>status</th>
              <th>current intent</th>
              <th>seen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a._id}>
                <td>{a.handle}</td>
                <td className="wrap" title={a.branch}>
                  <BranchStrip a={a} />
                </td>
                <td className={clsx("status", a.status)}>{a.status}</td>
                <td title={a.intent}>{a.intent ?? "—"}</td>
                <td className="dim">{ago(a.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pane>
  );
}
