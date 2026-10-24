/**
 * People paste whatever they were sent: a full link (`…/start?invite=CODE`, `…/app/invite/CODE`,
 * `…/join/CODE`) or the bare code. Returns the code, or null when nothing usable is there.
 */
export function parseInvite(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const query = text.match(/[?&]invite=([^&#\s]+)/);
  if (query?.[1]) return decodeURIComponent(query[1]);
  const path = text.match(/\/(?:invite|join)\/([^/?#\s]+)/);
  if (path?.[1]) return decodeURIComponent(path[1]);
  return /^[\w-]+$/.test(text) ? text : null;
}

export const inviteLink = (origin: string, code: string) =>
  `${origin}/start?invite=${encodeURIComponent(code)}`;

export const joinSlash = (code: string) => `/little-brother:join ${code}`;
export const joinEnv = (code: string) => `LB_SESSION=${code} claude`;
