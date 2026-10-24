import type { Metadata } from "next";
import { RoomsHome } from "@/components/rooms/rooms-home";

export const metadata: Metadata = { title: "Rooms · Little Brother" };

export default function RoomsPage() {
  return <RoomsHome />;
}
