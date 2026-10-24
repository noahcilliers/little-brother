import type { Metadata } from "next";
import { ClientApp } from "@/components/client-app";

export const metadata: Metadata = { title: "Dashboard · Little Brother" };

export default function DashboardPage() {
  return <ClientApp />;
}
