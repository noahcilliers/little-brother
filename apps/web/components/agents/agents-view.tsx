"use client";

import { useQuery } from "convex/react";
import { api } from "@/lib/api";
import { Empty, Loading } from "../ui/empty";
import { AgentStreamPane } from "./agent-stream";

export function AgentsView() {
  const agents = useQuery(api.dashboard.agents);
  if (agents === undefined) return <Loading what="agents" />;
  if (agents.length === 0) {
    return (
      <div className="tiles h-full">
        <div className="tile">
          <Empty
            title="no agent thoughts yet"
            sample={
              "› add CORS middleware to the API\n⏺ Edit(src/server.ts)\n  ⎿  denied · stale · use the vite /api proxy"
            }
          >
            One stream per session: prompts, tool calls in Claude Code's own vocabulary, and what Little
            Brother injected or denied.
          </Empty>
        </div>
      </div>
    );
  }
  const shown = agents.filter((a) => a.status !== "offline");
  return (
    <div className="streams">
      {(shown.length > 0 ? shown : agents).slice(0, 6).map((a) => (
        <AgentStreamPane key={a._id} agentId={a._id} />
      ))}
    </div>
  );
}
