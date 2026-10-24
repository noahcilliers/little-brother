import type { Metadata } from "next";
import { Suspense } from "react";
import { SessionView } from "@/components/session/session-view";

export const metadata: Metadata = { title: "Session · Little Brother" };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return (
    <Suspense>
      <SessionView sessionId={sessionId} />
    </Suspense>
  );
}
