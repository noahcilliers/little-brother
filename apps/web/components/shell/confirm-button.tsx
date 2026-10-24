"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";

type Props = {
  label: string;
  title: string;
  confirm: string;
  action?: string;
  busy?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  onConfirm: () => void;
};

/** Anything destructive asks once in a small dialog; only its confirm button acts. */
export function ConfirmButton({
  label,
  title,
  confirm,
  action,
  busy,
  danger,
  size = "md",
  onConfirm,
}: Props) {
  const [asking, setAsking] = useState(false);
  return (
    <>
      <Button
        variant={danger ? "danger" : "secondary"}
        size={size}
        onClick={() => setAsking(true)}
        disabled={busy}
      >
        {label}
      </Button>
      <Dialog
        open={asking}
        onClose={() => setAsking(false)}
        title={title}
        size="sm"
        footer={
          <>
            <Button onClick={() => setAsking(false)}>Cancel</Button>
            <Button
              variant={danger ? "danger" : "primary"}
              disabled={busy}
              onClick={() => {
                setAsking(false);
                onConfirm();
              }}
            >
              {action ?? label}
            </Button>
          </>
        }
      >
        <p className="muted">{confirm}</p>
      </Dialog>
    </>
  );
}
