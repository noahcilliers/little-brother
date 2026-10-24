"use client";

import type { LevelFilter, LogFilter, LogSource, SourceFilter } from "@/lib/log-rows";
import { SOURCE_LABEL } from "@/lib/log-rows";
import { Icon } from "../ui/icon";
import { Segmented } from "../ui/tabs";

const LEVELS: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

type Props = {
  filter: LogFilter;
  onFilter: (f: LogFilter) => void;
  sources: LogSource[];
  live: boolean;
  onLive: (on: boolean) => void;
  range: string;
};

/** Search, level, source, live tail and the time range the table covers. */
export function LogsToolbar({ filter, onFilter, sources, live, onLive, range }: Props) {
  const sourceOptions: { id: SourceFilter; label: string }[] = [
    { id: "all", label: "All sources" },
    ...sources.map((s) => ({ id: s, label: SOURCE_LABEL[s] })),
  ];
  return (
    <div className="logs-toolbar">
      <label className="search">
        <Icon name="search" size={14} />
        <input
          type="search"
          placeholder="Search logs"
          aria-label="Search logs"
          value={filter.query}
          onChange={(e) => onFilter({ ...filter, query: e.target.value })}
        />
      </label>
      <Segmented
        label="Level"
        options={LEVELS}
        value={filter.level}
        onChange={(level) => onFilter({ ...filter, level })}
      />
      {sources.length > 1 ? (
        <select
          className="select"
          aria-label="Source"
          value={filter.source}
          onChange={(e) => onFilter({ ...filter, source: e.target.value as SourceFilter })}
        >
          {sourceOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      ) : null}
      <button
        type="button"
        className={live ? "live-toggle on" : "live-toggle"}
        aria-pressed={live}
        onClick={() => onLive(!live)}
        title={live ? "Pause the live tail" : "Resume the live tail"}
      >
        {live ? (
          <span className="dot dot-ok dot-pulse" aria-hidden="true" />
        ) : (
          <Icon name="pause" size={12} />
        )}
        {live ? "Live" : "Paused"}
      </button>
      <span className="logs-range">{range}</span>
    </div>
  );
}
