/** Scanned from the session's Share dialog: sign in, ask the host, land on this session's board. */
export const joinLink = (origin: string, invite: string, sessionId: string) =>
  `${origin}/r/${encodeURIComponent(invite)}?s=${encodeURIComponent(sessionId)}`;

/** The host's read-only live view; works without sign-in until the host turns it off. */
export const watchLink = (origin: string, token: string) => `${origin}/watch/${encodeURIComponent(token)}`;
