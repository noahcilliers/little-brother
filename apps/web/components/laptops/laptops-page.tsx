"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { ConnectLaptop } from "../connect/connect-laptop";
import { ConfirmButton } from "../shell/confirm-button";
import { PageHeader } from "../shell/page-header";
import { PageState } from "../shell/page-state";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { EmptyState } from "../ui/empty-state";

/** /app/rooms/[roomId]/laptops: your connected laptops (they're yours, not the room's). */
export function LaptopsPage() {
  const devices = useQuery(api.devices.list);
  const revoke = useMutation(api.devices.revoke);
  const [open, setOpen] = useState(false);
  const connect = (
    <Button variant="primary" icon="plus" onClick={() => setOpen(true)}>
      Connect a laptop
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Laptops"
        meta="Connected to your account"
        actions={devices?.length ? connect : null}
      />
      <main className="page">
        {devices === undefined ? (
          <PageState title="Loading" loading />
        ) : devices.length === 0 ? (
          <EmptyState icon="laptop" title="No laptops connected yet.">
            {connect}
          </EmptyState>
        ) : (
          <div className="data-table laptops-table">
            <div className="dt-head" aria-hidden="true">
              <span>Label</span>
              <span>Machine</span>
              <span>Status</span>
              <span>Connected</span>
              <span />
            </div>
            <ul className="dt-body">
              {devices.map((d) => (
                <li key={d.id} className="dt-row">
                  <span className="cell-name">{d.label}</span>
                  <span className="mono muted">{d.machine ?? "—"}</span>
                  <span>
                    {d.status === "active" ? (
                      <Badge tone="ok">Connected</Badge>
                    ) : (
                      <Badge tone="warn">Token unused</Badge>
                    )}
                  </span>
                  <span className="muted">
                    {d.joinedAt ? ago(d.joinedAt) : `created ${ago(d.createdAt)}`}
                  </span>
                  <span className="right">
                    <ConfirmButton
                      label="Revoke"
                      title={`Revoke ${d.machine ?? d.label}?`}
                      confirm="Its connector stops working at once."
                      danger
                      size="sm"
                      onConfirm={() => void revoke({ id: d.id })}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
      <Dialog open={open} onClose={() => setOpen(false)} title="Connect a laptop" size="md">
        <ConnectLaptop />
      </Dialog>
    </>
  );
}
