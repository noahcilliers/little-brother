"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { IconButton } from "./button";

type Base = { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode };

/**
 * The native <dialog> gives focus trapping, Esc and the top layer for free. Content mounts only while open,
 * so a closed dialog holds no live queries.
 */
function NativeDialog({
  open,
  onClose,
  className,
  label,
  children,
}: Omit<Base, "title"> & {
  className: string;
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={className}
      aria-label={label}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        // A press on the backdrop lands on the <dialog> itself; presses inside land on its content.
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? children : null}
    </dialog>
  );
}

type DialogProps = Base & { description?: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" };

export function Dialog({ open, onClose, title, description, footer, size = "md", children }: DialogProps) {
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      className={`dialog dialog-${size}`}
      label={typeof title === "string" ? title : "Dialog"}
    >
      <div className="dialog-inner">
        <header className="dialog-head">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <IconButton icon="x" label="Close" onClick={onClose} />
        </header>
        <div className="dialog-body">{children}</div>
        {footer ? <footer className="dialog-foot">{footer}</footer> : null}
      </div>
    </NativeDialog>
  );
}

type SheetProps = Base & { side?: "left" | "right"; actions?: ReactNode; bare?: boolean };

/** A panel that slides in from an edge: the log details drawer, and the sidebar on phones. */
export function Sheet({ open, onClose, title, side = "right", actions, bare = false, children }: SheetProps) {
  return (
    <NativeDialog
      open={open}
      onClose={onClose}
      className={`sheet sheet-${side}`}
      label={typeof title === "string" ? title : "Panel"}
    >
      {bare ? (
        children
      ) : (
        <div className="sheet-inner">
          <header className="sheet-head">
            <h2>{title}</h2>
            {actions}
            <IconButton icon="x" label="Close" onClick={onClose} />
          </header>
          <div className="sheet-body">{children}</div>
        </div>
      )}
    </NativeDialog>
  );
}
