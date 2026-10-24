"use client";

import { type LogRow, logTime, SOURCE_LABEL } from "@/lib/log-rows";

type Props = {
  rows: LogRow[];
  total: number;
  selected: string | null;
  onSelect: (id: string) => void;
  showSession: boolean;
};

/** Dense, monospace, newest first; each row is a button that opens its details. */
export function LogsTable({ rows, total, selected, onSelect, showSession }: Props) {
  return (
    <div className={showSession ? "logs-table with-session" : "logs-table"}>
      <div className="logs-head" aria-hidden="true">
        <span>Time</span>
        <span />
        <span>Source</span>
        <span>Who</span>
        {showSession ? <span>Session</span> : null}
        <span>Message</span>
      </div>
      <ol className="log-rows" aria-label="Log lines, newest first">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              className={`log-row l-${r.level}`}
              data-selected={selected === r.id || undefined}
              onClick={() => onSelect(r.id)}
            >
              <span className="log-time">{logTime(r.at)}</span>
              <span className="log-level" title={r.level}>
                <i />
              </span>
              <span className="log-src">{SOURCE_LABEL[r.source]}</span>
              <span className="log-who" title={`@${r.who}`}>
                {r.who}
              </span>
              {showSession ? (
                <span className="log-session" title={r.session ?? undefined}>
                  {r.session ?? "room"}
                </span>
              ) : null}
              <span className="log-msg">{r.message}</span>
            </button>
          </li>
        ))}
      </ol>
      {total > rows.length ? (
        <p className="logs-cap">
          Showing the newest {rows.length} of {total}. Narrow the filters to see older lines.
        </p>
      ) : null}
    </div>
  );
}
