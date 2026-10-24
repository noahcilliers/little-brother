"use client";

import { ActivityTable } from "./activity-table";
import { AgentsTable } from "./agents-table";
import { EventTypesTable } from "./event-types-table";

export function TablesView() {
  return (
    <div className="tiles h-full grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <ActivityTable />
      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-px bg-[var(--line)]">
        <EventTypesTable />
        <AgentsTable />
      </div>
    </div>
  );
}
