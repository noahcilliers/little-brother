import type { ReactNode } from "react";
import "@/styles/app.css";
import { ClientApp } from "@/components/client-app";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <ClientApp>{children}</ClientApp>;
}
