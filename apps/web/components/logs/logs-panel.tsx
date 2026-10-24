"use client";

import { useMemo, useState } from "react";
import { filterRows, type LogFilter, type LogRow, type LogSource, logTime } from "@/lib/log-rows";
import { PageState } from "../shell/page-state";
import { Sheet } from "../ui/dialog";
import { EmptyState } from "../ui/empty-state";
import { LogDetails } from "./log-details";
import { LogsTable } from "./logs-table";
import { LogsToolbar } from "./logs-toolbar";

// Rendering thousands of rows makes typing in the search box lag; the newest lines are what people read.
const MAX_ROWS = 400;

type Props = {
  /** Newest first; undefined while loading. */
  rows: LogRow[] | undefined;
  sources: LogSource[];
  showSession?: boolean;
  empty: string;
};

const rangeText = (rows: LogRow[]) => {
  const first = rows[rows.length - 1];
  const last = rows[0];
  if (!first || !last) return "No lines";
  return `${logTime(first.at)} – ${logTime(last.at)} · ${rows.length} lines`;
};

/** Runtime-logs style panel: toolbar, dense table, and a details drawer. */
export function LogsPanel({ rows, sources, showSession = false, empty }: Props) {
  const [filter, setFilter] = useState<LogFilter>({ query: "", level: "all", source: "all" });
  const [live, setLive] = useState(true);
  const [frozen, setFrozen] = useState<LogRow[] | undefined>(undefined);
  const [selected, setSelected] = useState<string | null>(null);
  const source = live ? rows : (frozen ?? rows);
  const matched = useMemo(() => filterRows(source ?? [], filter), [source, filter]);
  const row = useMemo(() => (source ?? []).find((r) => r.id === selected) ?? null, [source, selected]);
  if (rows === undefined) return <PageState title="Loading logs" loading />;
  const toggleLive = (on: boolean) => {
    setFrozen(on ? undefined : rows);
    setLive(on);
  };
  return (
    <div className="logs">
      <LogsToolbar
        filter={filter}
        onFilter={setFilter}
        sources={sources}
        live={live}
        onLive={toggleLive}
        range={rangeText(matched)}
      />
      {rows.length === 0 ? (
        <EmptyState icon="logs" title={empty} />
      ) : matched.length === 0 ? (
        <EmptyState icon="search" title="No lines match these filters." />
      ) : (
        <LogsTable
          rows={matched.slice(0, MAX_ROWS)}
          total={matched.length}
          selected={selected}
          onSelect={setSelected}
          showSession={showSession}
        />
      )}
      <Sheet open={row !== null} onClose={() => setSelected(null)} title="Log line">
        {row ? <LogDetails row={row} /> : null}
      </Sheet>
    </div>
  );
}
