"use client";

import { useQuery } from "convex/react";
import { api, type Id } from "@/lib/api";
import { clock } from "@/lib/format";
import { shortSha } from "@/lib/git";
import { Badge } from "../ui/badge";
import { Empty, Loading } from "../ui/empty";
import { GitTag } from "../ui/git-tag";

export function NodePanel({ nodeId, onClose }: { nodeId: string; onClose: () => void }) {
  const d = useQuery(api.dashboard.nodeDetail, { nodeId: nodeId as Id<"nodes"> });
  return (
    <aside className="side" aria-label="Node details">
      <div className="ph">
        <span>node · {d?.agent?.handle ?? "…"}</span>
        <button type="button" className="ghost-btn" onClick={onClose}>
          close
        </button>
      </div>
      <div className="scroll">
        {d === undefined ? (
          <Loading what="node" />
        ) : d === null ? (
          <Empty title="node not found" />
        ) : (
          <>
            <section>
              <div className="sigbox">{d.node.text}</div>
              <dl className="kv">
                <dt>kind</dt>
                <dd>{d.node.kind}</dd>
                <dt>topic</dt>
                <dd>{d.node.topic ?? "—"}</dd>
                <dt>outcome</dt>
                <dd>{d.node.outcome}</dd>
                <dt>agent</dt>
                <dd>
                  {d.agent?.handle} · {d.agent?.branch}
                </dd>
                <dt>git</dt>
                <dd>
                  {d.node.landed ?? "not landed"}
                  {d.node.baseRev ? ` · base ${shortSha(d.node.baseRev)}` : ""}
                </dd>
                <dt>at</dt>
                <dd>{clock(d.node.at)}</dd>
              </dl>
            </section>
            <section>
              <span className="label">verdicts</span>
              {d.verdicts.length === 0 ? (
                <span className="ln res">normal · no overlap found</span>
              ) : (
                d.verdicts.map((v) => (
                  <div key={v._id} className="grid gap-2">
                    <div className="flex flex-wrap items-center gap-2 note">
                      <Badge kind={v.type} />
                      <span>
                        {v.takeover ? "takeover" : v.relation} · {v.action} · {v.status} ·{" "}
                        {Math.round(v.confidence * 100)}% · {v.source}
                      </span>
                      <GitTag status={v.gitStatus} />
                    </div>
                    {v.takeover ? (
                      <span className="ln lb">
                        {v.takeover.winner} took over {v.takeover.file} from {v.takeover.loser} (owner)
                      </span>
                    ) : null}
                    <p className="m-0 text-[13px]">{v.reason}</p>
                    {v.other ? (
                      <div className="sigbox">
                        {v.other.handle}: {v.other.text}
                      </div>
                    ) : null}
                    {v.evidence.length > 0 ? (
                      <ul className="list evidence">
                        {v.evidence.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
            </section>
            <section>
              <span className="label">touches</span>
              {d.node.touches.length === 0 ? (
                <span className="ln res">none recorded</span>
              ) : (
                <ul className="list">
                  {d.node.touches.map((t) => (
                    <li key={`${t.path}:${t.symbol ?? ""}:${t.op}`}>
                      {t.op} {t.symbol ?? t.path}
                      {t.lines ? ` L${t.lines.join("-")}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section>
              <span className="label">events</span>
              {d.events.length === 0 ? (
                <span className="ln res">no hook events linked</span>
              ) : (
                <ul className="list">
                  {d.events.map((e) => (
                    <li key={e._id}>
                      <span className="faint">{clock(e.at)}</span> {e.hook}
                      {e.tool ? ` · ${e.tool}` : ""} — {e.summary}
                      {e.tokens ? ` · ${e.tokens} tok` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
