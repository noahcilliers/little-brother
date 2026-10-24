import type { Metadata } from "next";
import { MembersPage } from "@/components/members/members-page";

export const metadata: Metadata = { title: "Members · Little Brother" };

export default async function Members({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <MembersPage roomId={roomId} />;
}
