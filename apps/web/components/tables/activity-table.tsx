"use client";

import { useQuery } from "convex/react";
import { type ActivityRow, api } from "@/lib/api";
import { clock } from "@/lib/format";
import { gitLabel } from "@/lib/git";
import { Badge } from "../ui/badge";
import { Empty, Loading } from "../ui/empty";
import { Pane } from "../ui/pane";

type Verify = NonNullable<ActivityRow["verify"]>;

function verifyText(v: Verify): string {
  const run = v.background ? "background merge-tree" : "lb verify";
  const branches = v.branches.length > 0 ? v.branches.join(" + ") : "branches";
  const result = v.passed === undefined ? "" : v.passed ? " · passed" : " · FAILED";
  return `${run} · ${branches} · ${v.conflicts} conflict${v.conflicts === 1 ? "" : "s"}${result}`;
}

function typeTitle(r: ActivityRow): string | undefined {
  if (r.verify) return verifyText(r.verify);
  if (r.type === "normal") return undefined;
  const what = [r.type, r.takeover ? "takeover" : r.relation?.replace(/_/g, " "), r.action];
  return [...what, gitLabel(r.gitStatus)].filter(Boolean).join(" · ");
}

function TypeCell({ r }: { r: ActivityRow }) {
  if (r.verify) return <Badge kind="verify" title={typeTitle(r)} />;
  // A git-found miss outranks the live type in this column: it is the row someone needs to look at.
  if (r.gitStatus === "missed")
    return <Badge kind="git-missed" title={typeTitle(r)}>{`${r.type} · missed`}</Badge>;
  return <Badge kind={r.type} title={typeTitle(r)} />;
}

export function ActivityTable() {
  const rows = useQuery(api.dashboard.activity, { limit: 100 });
  return (
    <Pane
      title="activity"
      meta={rows ? `events · latest ${rows.length}` : "events"}
      className="min-h-[320px]"
    >
      {rows === undefined ? (
        <Loading what="activity" />
      ) : rows.length === 0 ? (
        <Empty
          title="no events yet"
          sample={"23:41:07  noah    PreToolUse  EDIT db.users db/schema/users.ts"}
        >
          Every hook and MCP call lands here as an append-only row, with the event type its node was
          classified as.
        </Empty>
      ) : (
        <table className="ev">
          <colgroup>
            <col style={{ width: 84 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 128 }} />
            <col />
            <col style={{ width: 132 }} />
          </colgroup>
          <thead>
            <tr>
              <th>time</th>
              <th>agent</th>
              <th>hook</th>
              <th>signature</th>
              <th>type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r._id}>
                <td className="dim">{clock(r.at)}</td>
                <td className="dim">{r.handle}</td>
                <td>{r.verify?.background ? "merge-tree" : r.hook}</td>
                <td title={r.verify ? verifyText(r.verify) : r.signature}>
                  {r.verify ? verifyText(r.verify) : r.signature}
                </td>
                <td>
                  <TypeCell r={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Pane>
  );
}
