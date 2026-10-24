"use client";

import { useState } from "react";
import type { SessionHead } from "@/lib/api";
import { ShareDialog } from "./share-dialog";

export function ShareButton({ session }: { session: SessionHead }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
        Share · QR
      </button>
      {open ? <ShareDialog session={session} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
