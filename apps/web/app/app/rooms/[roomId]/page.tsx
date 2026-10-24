import type { Metadata } from "next";
import { SessionsPage } from "@/components/sessions/sessions-page";

export const metadata: Metadata = { title: "Sessions · Little Brother" };

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <SessionsPage roomId={roomId} />;
}
