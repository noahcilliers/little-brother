"use client";

import type { ToastTone } from "@/components/shell/toasts";
import { useToast } from "@/components/shell/toasts";
import type { Board, BoardCatch } from "./api";
import { useArrivals } from "./use-arrivals";

const TONE: Record<BoardCatch["kind"], ToastTone> = {
  conflict: "conflict",
  duplicate: "warn",
  stale: "warn",
  ordering: "info",
  takeover: "info",
};
const TITLE: Record<BoardCatch["kind"], string> = {
  conflict: "Conflict",
  duplicate: "Duplicate caught",
  stale: "Stale path avoided",
  ordering: "Ordering wait",
  takeover: "Takeover",
};

/** Each new catch pops up as it lands; a conflict waiting on a person offers to open the decision. */
export function useCatchToasts(
  board: Board | undefined,
  opts: { readOnly: boolean; onSelect: (taskId: string) => void; onDecide: () => void },
): void {
  const toast = useToast();
  useArrivals(
    board?.catches,
    (c) => c.id,
    (c) => {
      if (!board) return;
      const who = (id: string) => {
        const agentId =
          board.tasks.find((t) => t.id === id)?.agentId ?? board.goals.find((g) => g.id === id)?.agentId;
        return board.agents.find((a) => a.id === agentId)?.name;
      };
      const pair = [who(c.from), who(c.to)].filter(Boolean).join(" ↔ ");
      const decide = c.kind === "conflict" && c.until === null && !opts.readOnly;
      toast({
        id: `catch:${c.id}`,
        tone: TONE[c.kind],
        title: `${TITLE[c.kind]}${pair ? ` · ${pair}` : ""}`,
        body: c.text,
        sticky: decide,
        action: decide
          ? { label: "Decide", run: opts.onDecide }
          : { label: "Show", run: () => opts.onSelect(c.from) },
      });
    },
  );
}
