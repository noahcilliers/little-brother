import type { Metadata } from "next";
import "@/styles/app.css";
import { PublicApp } from "@/components/public-app";
import { WatchView } from "@/components/share/watch-view";

export const metadata: Metadata = { title: "Live · Little Brother", robots: { index: false } };

export default async function WatchPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <PublicApp>
      <WatchView token={decodeURIComponent(token)} />
    </PublicApp>
  );
}
