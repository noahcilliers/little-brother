import type { Metadata } from "next";
import { RoomLogsPage } from "@/components/logs/room-logs-page";

export const metadata: Metadata = { title: "Logs · Little Brother" };

export default async function LogsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomLogsPage roomId={roomId} />;
}
