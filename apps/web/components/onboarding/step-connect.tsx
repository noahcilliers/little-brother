"use client";

import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/lib/api";
import { ConnectLaptop } from "../connect/connect-laptop";
import { LiveCheck } from "../ui/badge";
import { Button } from "../ui/button";

/** Step 2: this laptop's connector. Already connected laptops count; another one is a click away. */
export function StepConnect() {
  const devices = useQuery(api.devices.list);
  const [another, setAnother] = useState(false);
  const active = (devices ?? []).filter((d) => d.status === "active");
  if (active.length > 0 && !another)
    return (
      <div className="stack-sm">
        <LiveCheck done waiting="" ok={`Connected: ${active.map((d) => d.machine ?? d.label).join(", ")}`} />
        <div>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setAnother(true)}>
            Connect another laptop
          </Button>
        </div>
      </div>
    );
  return <ConnectLaptop />;
}
