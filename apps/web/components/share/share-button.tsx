"use client";

import { useState } from "react";
import type { SessionHead } from "@/lib/api";
import { Button } from "../ui/button";
import { ShareDialog } from "./share-dialog";

export function ShareButton({ session }: { session: SessionHead }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button icon="share" onClick={() => setOpen(true)}>
        Share
      </Button>
      {open ? <ShareDialog session={session} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
