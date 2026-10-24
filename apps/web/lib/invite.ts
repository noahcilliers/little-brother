export { parseInvite } from "@lb/core";

export const inviteLink = (origin: string, code: string) =>
  `${origin}/login?invite=${encodeURIComponent(code)}`;

export const joinSlash = (code: string) => `/little-brother:join ${code}`;
export const joinEnv = (code: string) => `LB_SESSION=${code} claude`;
