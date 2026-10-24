"use client";

import { clsx } from "clsx";
import { useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { type AgentStream, api, type Id } from "@/lib/api";
import { clock } from "@/lib/format";
import { StateBadge } from "../ui/badge";
import { Loading } from "../ui/empty";
import { GitTag } from "../ui/git-tag";

type Line = AgentStream["lines"][number];
type Inbox = AgentStream["inbox"][number];
type Item = { at: number; key: string; line?: Line; inbox?: Inbox };

function toolCall(l: Line): string {
  const arg = l.files[0] ?? l.summary;
  return `${l.tool ?? "Tool"}(${arg.length > 60 ? `${arg.slice(0, 57)}…` : arg})`;
}

function EventLine({ l }: { l: Line }) {
  const t = <span className="t">{clock(l.at)}</span>;
  // Pre and Post events share a node; the verdict belongs to the moment Little Brother answered.
  const answered = l.hook === "PreToolUse" || l.hook === "UserPromptSubmit";
  const verdict = answered && l.verdict && l.verdict.type !== "normal" ? l.verdict : undefined;
  const denied = verdict && (verdict.action === "block" || verdict.action === "serialize");
  const body = (() => {
    switch (l.hook) {
      case "UserPromptSubmit":
        return <div className="ln prompt">{l.summary}</div>;
      case "PreToolUse":
        return (
          <div className="ln tool">
            {t}
            {toolCall(l)}
          </div>
        );
      case "PostToolUse":
        return <div className="ln res">{l.summary}</div>;
      case "PostToolUseFailure":
        return <div className="ln res fail">✕ {l.summary}</div>;
      case "Resolve":
        return (
          <div className="ln lb">
            <b>owner decision</b>
            {l.summary}
          </div>
        );
      default:
        return (
          <div className="ln text">
            {t}
            {l.hook.toLowerCase()} · {l.summary}
          </div>
        );
    }
  })();
  return (
    <>
      {body}
      {verdict ? (
        <div className={clsx("ln lb", verdict.takeover ? undefined : denied ? "deny" : "warn")}>
          <b className="flex items-center justify-between gap-2">
            <span>
              little brother · {verdict.takeover ? "took over" : denied ? "denied" : "warned"} ·{" "}
              {verdict.type}
            </span>
            <GitTag status={verdict.gitStatus} />
          </b>
          {verdict.takeover ? <div>{verdict.takeover}</div> : null}
          {verdict.reason}
        </div>
      ) : null}
    </>
  );
}

function InboxLine({ i }: { i: Inbox }) {
  return (
    <div className={clsx("ln lb", i.action === "warn" && "warn")}>
      <b className="flex items-center justify-between gap-2">
        <span>
          little brother · inbox · {i.action}
          {i.takeover ? " · takeover" : ""}
        </span>
        <StateBadge state={i.state} />
      </b>
      {i.takeover ? <div className="faint">{i.takeover}</div> : null}
      {i.text}
    </div>
  );
}

export function AgentStreamPane({ agentId }: { agentId: Id<"agents"> }) {
  const s = useQuery(api.dashboard.agentStream, { agentId });
  const end = useRef<HTMLDivElement>(null);
  const count = s ? s.lines.length + s.inbox.length : 0;
  useEffect(() => {
    const el = end.current;
    if (count > 0 && el) el.scrollTop = el.scrollHeight;
  }, [count]);

  if (s === undefined)
    return (
      <div className="pane">
        <Loading what="stream" />
      </div>
    );
  if (s === null) return null;
  const items: Item[] = [
    ...s.lines.map((line) => ({ at: line.at, key: line._id, line })),
    ...s.inbox.map((inbox) => ({ at: inbox.at, key: inbox._id, inbox })),
  ].sort((a, b) => a.at - b.at);
  return (
    <div className="pane">
      <div className="ph">
        <span>
          {s.agent.handle} · {s.agent.branch}
        </span>
        <small>
          claude code · {s.agent.machine} · {s.agent.status}
        </small>
      </div>
      <div className="scroll" ref={end}>
        <div className="lines">
          {items.length === 0 ? (
            <div className="ln text">Waiting for the first hook from this session.</div>
          ) : null}
          {items.map((it) =>
            it.line ? (
              <EventLine key={it.key} l={it.line} />
            ) : it.inbox ? (
              <InboxLine key={it.key} i={it.inbox} />
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}
