import type { Board } from "@/lib/api";
import { relations } from "@/lib/board-view";
import { elapsed } from "@/lib/format";
import { Icon } from "./glyph";
import { ResolveActions } from "./resolve-actions";

type Props = {
  board: Board;
  selected: string | null;
  t: number;
  start: number;
  onSelect: (id: string) => void;
  colorOf: (agentId: string | null) => string;
};

const KIND: Record<string, string> = {
  intent: "Intent",
  edit: "Action",
  ok: "Action · tests pass",
  fail: "Action · failed",
  blocked: "Blocked action",
  superseded: "Superseded action",
  lesson: "Lesson",
  decision: "Decision",
  verify: "Verification",
};

function tagColor(kind: string): string {
  if (kind === "conflict") return "var(--hot)";
  return kind === "duplicate" || kind === "stale" ? "var(--warn)" : "var(--muted)";
}

export function SelectedPanel({ board, selected, t, start, onSelect, colorOf }: Props) {
  const n = board.nodes.find((x) => x.id === selected && x.at <= t);
  const handle = board.agents.find((a) => a.id === n?.agentId)?.handle;
  const conflict = n ? board.conflicts.find((c) => c.a.id === n.id || c.b.id === n.id) : undefined;
  return (
    <div className="card">
      <div className="h">Selected</div>
      <div className="detail">
        {!n ? (
          <p className="empty">Click any node to see its files and what it connects to.</p>
        ) : (
          <>
            <div className="title">
              <Icon glyph={n.glyph} color={colorOf(n.agentId)} why={n.why} />
              {n.label}
            </div>
            <div className="meta">
              {KIND[n.glyph]} · {n.agentId ? (handle ?? "agent") : "all agents"} · {elapsed(n.at, start)}
            </div>
            {n.note ? <p className="note">{n.note}</p> : null}
            {n.files.length > 0 ? (
              <ul className="files">
                {n.files.map((f) => (
                  <li key={f.path}>
                    <span className="path">{f.path}</span>
                    <span className="op">{f.op}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="rel">
              {relations(board, n.id, t).map((r) => (
                <button key={r.key} type="button" onClick={() => onSelect(r.other.id)}>
                  <span className="tag" style={{ color: tagColor(r.kind) }}>
                    {r.word}
                  </span>
                  <Icon glyph={r.other.glyph} color={colorOf(r.other.agentId)} why={r.other.why} />
                  {r.other.label}
                </button>
              ))}
            </div>
            {conflict ? <ResolveActions conflict={conflict} /> : null}
          </>
        )}
      </div>
    </div>
  );
}
