import type { Metadata } from "next";
import { SessionView } from "@/components/session/session-view";

export const metadata: Metadata = { title: "Session · Little Brother" };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <SessionView sessionId={sessionId} />;
}
