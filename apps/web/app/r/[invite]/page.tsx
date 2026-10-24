import type { Metadata } from "next";
import "@/app/app/app.css";
import { PublicApp } from "@/components/public-app";
import { RoomInvite } from "@/components/share/room-invite";

export const metadata: Metadata = { title: "Join · Little Brother" };

type Props = { params: Promise<{ invite: string }>; searchParams: Promise<{ s?: string }> };

export default async function InvitePage({ params, searchParams }: Props) {
  const [{ invite }, { s }] = await Promise.all([params, searchParams]);
  const here = `/r/${encodeURIComponent(invite)}${s ? `?s=${encodeURIComponent(s)}` : ""}`;
  return (
    <PublicApp>
      <RoomInvite invite={decodeURIComponent(invite)} sessionId={s ?? null} here={here} />
    </PublicApp>
  );
}
