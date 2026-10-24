import type { Metadata } from "next";
import { RoomView } from "@/components/rooms/room-view";

export const metadata: Metadata = { title: "Room · Little Brother" };

export default async function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <RoomView roomId={roomId} />;
}
