import type { Metadata } from "next";
import { SettingsPage } from "@/components/settings/settings-page";

export const metadata: Metadata = { title: "Settings · Little Brother" };

export default async function Settings({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  return <SettingsPage roomId={roomId} />;
}
